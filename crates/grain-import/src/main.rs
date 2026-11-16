//! `grain-import <hatk's grain.db> [--into <index>] [--strict]`: hatk's
//! database read into a new index, at `GRAIN_INDEX` or `--into`
//! ([`grain_import`]).

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let var = |name: &str| std::env::var(name).ok();
    std::process::exit(grain_import::main(&args, var));
}
