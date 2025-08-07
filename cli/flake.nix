{
  description = "Grain CLI - A command-line interface for grain.social";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    crane = {
      url = "github:ipetkov/crane";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, crane, rust-overlay }:
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

        craneLib = (crane.mkLib pkgs).overrideToolchain rustToolchain;

        src = craneLib.cleanCargoSource (craneLib.path ./.);

        commonArgs = {
          inherit src;
          strictDeps = true;
          
          buildInputs = with pkgs; [
            openssl
          ] ++ pkgs.lib.optionals pkgs.stdenv.isDarwin [
            pkgs.darwin.apple_sdk.frameworks.Security
            pkgs.darwin.apple_sdk.frameworks.SystemConfiguration
          ];

          nativeBuildInputs = with pkgs; [
            pkg-config
          ];
        };

        # Build dependencies first for caching
        cargoArtifacts = craneLib.buildDepsOnly commonArgs;

        # Build function for different targets
        buildGrainCLI = target: 
          let
            # Only cross-compile if target is different from current system
            isCrossCompiling = target != system;
          in
          if isCrossCompiling then
            # For cross-compilation, use the native build but with target specified
            craneLib.buildPackage (commonArgs // {
              inherit cargoArtifacts;
              CARGO_BUILD_TARGET = target;
            } // pkgs.lib.optionalAttrs (target == "x86_64-pc-windows-gnu") {
              depsBuildBuild = with pkgs; [
                pkgsCross.mingwW64.stdenv.cc
              ];
              CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = "${pkgs.pkgsCross.mingwW64.stdenv.cc}/bin/x86_64-w64-mingw32-gcc";
            })
          else
            # For native builds, don't specify target
            craneLib.buildPackage (commonArgs // {
              inherit cargoArtifacts;
            });

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