{
  description = "Grain CLI - A command-line interface for grain.social";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" ];
          targets = [
            "x86_64-unknown-linux-gnu"
            "x86_64-pc-windows-gnu" 
            "x86_64-apple-darwin"
            "aarch64-apple-darwin"
            "aarch64-unknown-linux-gnu"
          ];
        };

        # Build function for different targets
        buildGrainCLI = target: pkgs.stdenv.mkDerivation rec {
          pname = "grain-cli-${target}";
          version = "0.1.0";
          
          src = ./.;
          
          nativeBuildInputs = with pkgs; [
            rustToolchain
            pkg-config
          ] ++ pkgs.lib.optionals (target == "x86_64-pc-windows-gnu") [
            pkgs.pkgsCross.mingwW64.stdenv.cc
          ];
          
          buildInputs = with pkgs; [
            openssl
          ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
            pkgs.darwin.apple_sdk.frameworks.Security
            pkgs.darwin.apple_sdk.frameworks.SystemConfiguration
          ];

          buildPhase = ''
            export CARGO_HOME=$TMPDIR/cargo
            export OPENSSL_NO_VENDOR=1
            export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig:$PKG_CONFIG_PATH"
            
            ${if target == "x86_64-pc-windows-gnu" then ''
              export CC_x86_64_pc_windows_gnu="${pkgs.pkgsCross.mingwW64.stdenv.cc}/bin/x86_64-w64-mingw32-gcc"
              export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER="${pkgs.pkgsCross.mingwW64.stdenv.cc}/bin/x86_64-w64-mingw32-gcc"
              export PKG_CONFIG_ALLOW_CROSS=1
            '' else ""}
            
            cargo build --release --target ${target}
          '';
          
          installPhase = ''
            mkdir -p $out/bin
            cp target/${target}/release/grain${if target == "x86_64-pc-windows-gnu" then ".exe" else ""} $out/bin/
          '';
        };

      in {
        packages = {
          default = buildGrainCLI system;
          
          # Cross-compilation targets
          grain-linux-x86_64 = buildGrainCLI "x86_64-unknown-linux-gnu";
          grain-linux-aarch64 = buildGrainCLI "aarch64-unknown-linux-gnu";
          grain-macos-x86_64 = buildGrainCLI "x86_64-apple-darwin";
          grain-macos-aarch64 = buildGrainCLI "aarch64-apple-darwin";
          grain-windows-x86_64 = buildGrainCLI "x86_64-pc-windows-gnu";
        };

        devShells.default = pkgs.mkShell {
          inputsFrom = [ self.packages.${system}.default ];
          packages = with pkgs; [
            rustToolchain
            pkg-config
            openssl
            cargo-cross
          ];
        };

        # Helper script to build all targets
        apps.build-all = flake-utils.lib.mkApp {
          drv = pkgs.writeShellScriptBin "build-all" ''
            set -e
            
            echo "Building Grain CLI for all platforms..."
            
            mkdir -p releases
            
            # Build for each platform
            echo "Building for Linux x86_64..."
            nix build .#grain-linux-x86_64 -o result-linux-x86_64
            cp result-linux-x86_64/bin/grain releases/grain-linux-x86_64
            
            echo "Building for Linux aarch64..."
            nix build .#grain-linux-aarch64 -o result-linux-aarch64
            cp result-linux-aarch64/bin/grain releases/grain-linux-aarch64
            
            echo "Building for macOS x86_64..."
            nix build .#grain-macos-x86_64 -o result-macos-x86_64
            cp result-macos-x86_64/bin/grain releases/grain-darwin-x86_64
            
            echo "Building for macOS aarch64..."
            nix build .#grain-macos-aarch64 -o result-macos-aarch64
            cp result-macos-aarch64/bin/grain releases/grain-darwin-aarch64
            
            echo "Building for Windows x86_64..."
            nix build .#grain-windows-x86_64 -o result-windows-x86_64
            cp result-windows-x86_64/bin/grain.exe releases/grain-windows-x86_64.exe
            
            echo "All builds complete! Binaries are in releases/"
            ls -la releases/
          '';
        };
      });
}