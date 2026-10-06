//! High-performance dimer engine for `@sfstudio_tools/primer-calc`.
//!
//! Strict parity with the TypeScript engine (`src/structure/dimer.ts` +
//! `src/thermo/nearest-neighbor.ts`):
//! - SantaLucia (1998) unified nearest-neighbor stacks, duplex initiation,
//!   terminal A·T penalties, self-complementary symmetry correction;
//! - single-nucleotide dangling ends (Bommarito, Peyret & SantaLucia 2000,
//!   via SantaLucia & Hicks 2004 Table 3);
//! - ungapped block scan plus single-mismatch-bridged merges;
//! - polymerase-extendable 3′ anchoring (run ≥ 2 nt).
//!
//! Build:
//! ```sh
//! npm run build:wasm   # cargo + wasm-bindgen, see package.json
//! ```

use wasm_bindgen::prelude::*;

const R_CAL: f64 = 1.987;
const ZERO_C: f64 = 273.15;
const T37: f64 = 310.15;

fn is_wc(a: u8, b: u8) -> bool {
    matches!(
        (a, b),
        (b'A', b'T') | (b'T', b'A') | (b'G', b'C') | (b'C', b'G')
    )
}

/// SantaLucia (1998) unified NN stack → (dH kcal/mol, dS cal/(mol·K)).
fn nn_params(t0: u8, t1: u8, b0: u8, b1: u8) -> Option<(f64, f64)> {
    const TABLE: [((u8, u8, u8, u8), (f64, f64)); 10] = [
        ((b'A', b'A', b'T', b'T'), (-7.6, -21.3)),
        ((b'A', b'T', b'T', b'A'), (-7.2, -20.4)),
        ((b'T', b'A', b'A', b'T'), (-7.2, -21.3)),
        ((b'C', b'A', b'G', b'T'), (-8.5, -22.7)),
        ((b'G', b'T', b'C', b'A'), (-8.4, -22.4)),
        ((b'C', b'T', b'G', b'A'), (-7.8, -21.0)),
        ((b'G', b'A', b'C', b'T'), (-8.2, -22.2)),
        ((b'C', b'G', b'G', b'C'), (-10.6, -27.2)),
        ((b'G', b'C', b'C', b'G'), (-9.8, -24.4)),
        ((b'G', b'G', b'C', b'C'), (-8.0, -19.9)),
    ];
    for ((a, b, c, d), v) in TABLE {
        if (a, b, c, d) == (t0, t1, b0, b1) {
            return Some(v);
        }
        // 180° rotation symmetry: XY/WZ ≡ reverse(WZ)/reverse(XY).
        if (d, c, b, a) == (t0, t1, b0, b1) {
            return Some(v);
        }
    }
    None
}

/// Single-nucleotide dangling end → (dH, dS).
/// `five_prime`: overhang side; `same`/`opp`: closing-pair bases on the
/// dangling strand / opposite strand; `d`: the unpaired base.
fn dangle_params(five_prime: bool, same: u8, opp: u8, d: u8) -> Option<(f64, f64)> {
    let dg: f64 = match (five_prime, same, opp, d) {
        // 5' dangling ends.
        (true, b'A', b'T', b'A') => -0.51,
        (true, b'A', b'T', b'C') => -0.42,
        (true, b'A', b'T', b'G') => -0.62,
        (true, b'A', b'T', b'T') => -0.71,
        (true, b'C', b'G', b'A') => -0.96,
        (true, b'C', b'G', b'C') => -0.52,
        (true, b'C', b'G', b'G') => -0.72,
        (true, b'C', b'G', b'T') => -0.58,
        (true, b'G', b'C', b'A') => -0.58,
        (true, b'G', b'C', b'C') => -0.34,
        (true, b'G', b'C', b'G') => -0.56,
        (true, b'G', b'C', b'T') => -0.61,
        (true, b'T', b'A', b'A') => -0.50,
        (true, b'T', b'A', b'C') => -0.02,
        (true, b'T', b'A', b'G') => 0.48,
        (true, b'T', b'A', b'T') => -0.10,
        // 3' dangling ends.
        (false, b'A', b'T', b'A') => -0.12,
        (false, b'A', b'T', b'C') => 0.28,
        (false, b'A', b'T', b'G') => -0.01,
        (false, b'A', b'T', b'T') => 0.13,
        (false, b'C', b'G', b'A') => -0.82,
        (false, b'C', b'G', b'C') => -0.31,
        (false, b'C', b'G', b'G') => -0.01,
        (false, b'C', b'G', b'T') => -0.52,
        (false, b'G', b'C', b'A') => -0.92,
        (false, b'G', b'C', b'C') => -0.23,
        (false, b'G', b'C', b'G') => -0.44,
        (false, b'G', b'C', b'T') => -0.35,
        (false, b'T', b'A', b'A') => -0.48,
        (false, b'T', b'A', b'C') => -0.19,
        (false, b'T', b'A', b'G') => -0.50,
        (false, b'T', b'A', b'T') => -0.29,
        _ => return None,
    };
    let dh: f64 = match (five_prime, same, opp, d) {
        (true, b'A', b'T', b'A') => 0.2,
        (true, b'A', b'T', b'C') => 0.6,
        (true, b'A', b'T', b'G') => -1.1,
        (true, b'A', b'T', b'T') => -6.9,
        (true, b'C', b'G', b'A') => -6.3,
        (true, b'C', b'G', b'C') => -4.4,
        (true, b'C', b'G', b'G') => -5.1,
        (true, b'C', b'G', b'T') => -4.0,
        (true, b'G', b'C', b'A') => -3.7,
        (true, b'G', b'C', b'C') => -4.0,
        (true, b'G', b'C', b'G') => -3.9,
        (true, b'G', b'C', b'T') => -4.9,
        (true, b'T', b'A', b'A') => -2.9,
        (true, b'T', b'A', b'C') => -4.1,
        (true, b'T', b'A', b'G') => -4.2,
        (true, b'T', b'A', b'T') => -0.2,
        (false, b'A', b'T', b'A') => -0.5,
        (false, b'A', b'T', b'C') => 4.7,
        (false, b'A', b'T', b'G') => -4.1,
        (false, b'A', b'T', b'T') => -3.8,
        (false, b'C', b'G', b'A') => -5.9,
        (false, b'C', b'G', b'C') => -2.6,
        (false, b'C', b'G', b'G') => -3.2,
        (false, b'C', b'G', b'T') => -5.2,
        (false, b'G', b'C', b'A') => -2.1,
        (false, b'G', b'C', b'C') => -0.2,
        (false, b'G', b'C', b'G') => -3.9,
        (false, b'G', b'C', b'T') => -4.4,
        (false, b'T', b'A', b'A') => -0.7,
        (false, b'T', b'A', b'C') => 4.4,
        (false, b'T', b'A', b'G') => -1.6,
        (false, b'T', b'A', b'T') => 2.9,
        _ => return None,
    };
    Some((dh, (dh - dg) * 1000.0 / T37))
}

#[derive(Clone, Copy, Default)]
struct Flanks {
    top5: Option<u8>,
    bottom3: Option<u8>,
    top3: Option<u8>,
    bottom5: Option<u8>,
}

/// Score one alignment. Returns (dH, dS, paired_count).
fn score_alignment(
    top: &[u8],
    bot: &[u8],
    self_comp: bool,
    fl: Flanks,
) -> Option<(f64, f64, usize)> {
    let paired: Vec<usize> = (0..top.len())
        .filter(|&i| is_wc(top[i], bot[i]))
        .collect();
    if paired.is_empty() {
        return None;
    }
    let mut dh = 0.2_f64;
    let mut ds = -5.7_f64;
    let first = paired[0];
    let last = paired[paired.len() - 1];
    // Bit-identical accumulation order with the TypeScript engine
    // (single scaled terminal correction, stacks in 5′→3′ order).
    let mut terminal_at = 0u32;
    for &e in &[first, last] {
        if top[e] == b'A' || top[e] == b'T' {
            terminal_at += 1;
        }
    }
    for w in paired.windows(2) {
        if w[1] == w[0] + 1 {
            if let Some((h, s)) = nn_params(top[w[0]], top[w[1]], bot[w[0]], bot[w[1]]) {
                dh += h;
                ds += s;
            }
        }
    }
    dh += 2.2 * terminal_at as f64;
    ds += 6.9 * terminal_at as f64;
    let t5 = top[first];
    let u5 = bot[first];
    let t3 = top[last];
    let u3 = bot[last];
    for (five, same, opp, base) in [
        (true, t5, u5, fl.top5),
        (false, u5, t5, fl.bottom3),
        (false, t3, u3, fl.top3),
        (true, u3, t3, fl.bottom5),
    ] {
        if let Some(b) = base {
            if let Some((h, s)) = dangle_params(five, same, opp, b) {
                dh += h;
                ds += s;
            }
        }
    }
    if self_comp {
        ds -= 1.4;
    }
    Some((dh, ds, paired.len()))
}

struct Best {
    dg: f64,
    dh: f64,
    ds: f64,
    paired: usize,
    run: usize,
    anchored: bool,
    gc_frac: f64,
    span: usize,
}

fn depict(top: &[u8], bot: &[u8]) -> (Vec<u8>, Vec<u8>) {
    let mut t = Vec::with_capacity(top.len());
    let mut u = Vec::with_capacity(bot.len());
    for (&a, &b) in top.iter().zip(bot.iter()) {
        if is_wc(a, b) {
            t.push(a);
            u.push(b);
        } else {
            t.push(b'-');
            u.push(b'-');
        }
    }
    (t, u)
}

fn trailing_run_cond(dep: &[u8], reached: bool) -> usize {
    if !reached {
        return 0;
    }
    dep.iter().rev().take_while(|&&c| c != b'-').count()
}

fn leading_run_cond(dep: &[u8], reached: bool) -> usize {
    if !reached {
        return 0;
    }
    dep.iter().take_while(|&&c| c != b'-').count()
}

fn scan(
    a: &[u8],
    brev: &[u8],
    self_comp: bool,
    eval_temp_c: f64,
) -> Option<Best> {
    let t_k = eval_temp_c + ZERO_C;
    let mut best: Option<Best> = None;
    let consider = |top: &[u8],
                         bot: &[u8],
                         a_start: usize,
                         b_start: usize,
                         best: &mut Option<Best>| {
        let paired_wc = top
            .iter()
            .zip(bot.iter())
            .filter(|(&x, &y)| is_wc(x, y))
            .count();
        if paired_wc < 2 {
            return;
        }
        let len = top.len();
        let fl = Flanks {
            top5: a_start.checked_sub(1).map(|i| a[i]),
            bottom3: b_start.checked_sub(1).map(|j| brev[j]),
            top3: (a_start + len < a.len()).then(|| a[a_start + len]),
            bottom5: (b_start + len < brev.len()).then(|| brev[b_start + len]),
        };
        if let Some((dh, ds, paired)) = score_alignment(top, bot, self_comp, fl) {
            let dg = dh - t_k * ds / 1000.0;
            let replace = best.as_ref().map_or(true, |b: &Best| dg < b.dg);
            if replace {
                let (td, ud) = depict(top, bot);
                // A strand whose block misses its 3′ terminus (overhang)
                // cannot be extended: run 0 by definition. Top is 5′→3′
                // (3′ end right), bottom is 3′→5′ (3′ end left).
                let run = trailing_run_cond(&td, a_start + len == a.len())
                    .max(leading_run_cond(&ud, b_start == 0));
                // Traced duplex composition for Owczarzy %GC/N (GC pairs/span).
                let gc = top
                    .iter()
                    .zip(bot.iter())
                    .filter(|(&x, &y)| {
                        is_wc(x, y) && (x == b'G' || x == b'C')
                    })
                    .count();
                *best = Some(Best {
                    dg,
                    dh,
                    ds,
                    paired,
                    run,
                    anchored: run >= 2,
                    gc_frac: gc as f64 / len as f64,
                    span: len,
                });
            }
        }
    };

    let alo = 0isize - (brev.len() as isize - 1);
    let ahi = a.len() as isize - 1;
    for d in alo..=ahi {
        let cells: Vec<(usize, usize)> = (0..a.len())
            .filter_map(|i| {
                let j = i as isize - d;
                (j >= 0 && (j as usize) < brev.len()).then_some((i, j as usize))
            })
            .collect();
        let mut blocks: Vec<(usize, usize, usize)> = Vec::new(); // (a_start, b_start, len)
        let mut k = 0;
        while k < cells.len() {
            if !is_wc(a[cells[k].0], brev[cells[k].1]) {
                k += 1;
                continue;
            }
            let mut k2 = k;
            while k2 + 1 < cells.len()
                && is_wc(a[cells[k2 + 1].0], brev[cells[k2 + 1].1])
            {
                k2 += 1;
            }
            let (i0, j0) = cells[k];
            blocks.push((i0, j0, k2 - k + 1));
            k = k2 + 1;
        }
        for &(i0, j0, len) in &blocks {
            consider(&a[i0..i0 + len], &brev[j0..j0 + len], i0, j0, &mut best);
        }
        for w in blocks.windows(2) {
            let (li, lj, llen) = w[0];
            let (ri, rj, _rlen) = w[1];
            if ri == li + llen + 1 && rj == lj + llen + 1 {
                let mut top = Vec::from(&a[li..li + llen]);
                top.push(a[li + llen]);
                top.extend_from_slice(&a[ri..ri + w[1].2]);
                let mut bot = Vec::from(&brev[lj..lj + llen]);
                bot.push(brev[lj + llen]);
                bot.extend_from_slice(&brev[rj..rj + w[1].2]);
                consider(&top, &bot, li, lj, &mut best);
            }
        }
    }
    best
}

/// Full dimer report as JSON:
/// `{"found":bool,"dg":…,"tm":…,"paired":…,"run3p":…,"anchored":bool}`.
/// Temperatures in °C; `ct_m` = total strand concentration (M);
/// `salt_adj_c` = precomputed salt term (°C).
#[wasm_bindgen]
pub fn dimer_report_json(
    a: &str,
    b: &str,
    self_complementary: bool,
    eval_temp_c: f64,
    ct_m: f64,
    salt_adj_c: f64,
    dmso_percent: f64,
) -> String {
    let av: Vec<u8> = a.bytes().map(|c| c.to_ascii_uppercase()).collect();
    let bv: Vec<u8> = b.bytes().map(|c| c.to_ascii_uppercase()).collect();
    let brev: Vec<u8> = bv.iter().rev().copied().collect();
    if av.is_empty() || brev.is_empty() {
        return "{\"found\":false}".to_string();
    }
    match scan(&av, &brev, self_complementary, eval_temp_c) {
        None => "{\"found\":false}".to_string(),
        Some(best) => {
            let conc = if self_complementary {
                R_CAL * ct_m.ln()
            } else {
                R_CAL * (ct_m / 2.0).ln()
            };
            let tm =
                best.dh * 1000.0 / (best.ds + conc) - ZERO_C + salt_adj_c
                    - 0.75 * dmso_percent;
            // `{}` prints the shortest round-tripping decimal: bit-identical
            // f64 values on the TypeScript side after JSON.parse.
            format!(
                "{{\"found\":true,\"dg\":{},\"tm\":{},\"paired\":{},\"run3p\":{},\"anchored\":{},\"dh\":{},\"ds\":{},\"gc\":{},\"n\":{}}}",
                best.dg,
                tm,
                best.paired,
                best.run,
                if best.anchored { "true" } else { "false" },
                best.dh,
                best.ds,
                best.gc_frac,
                best.span
            )
        }
    }
}

/// N×N cross-dimerization ΔG°37 matrix (row-major, `NaN` = no dimer).
/// `seqs` are `|`-separated unambiguous primer sequences.
#[wasm_bindgen]
pub fn cross_dimer_matrix(seqs: &str) -> Vec<f64> {
    let list: Vec<Vec<u8>> = seqs
        .split('|')
        .map(|s| s.bytes().map(|c| c.to_ascii_uppercase()).collect())
        .collect();
    let n = list.len();
    let mut out = vec![f64::NAN; n * n];
    for i in 0..n {
        for j in i..n {
            let brev: Vec<u8> = list[j].iter().rev().copied().collect();
            if let Some(b) = scan(&list[i], &brev, i == j, 37.0) {
                out[i * n + j] = b.dg;
                out[j * n + i] = b.dg;
            }
        }
    }
    out
}
