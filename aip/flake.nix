{
  description = "AIP service for Grain";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    crane.url = "github:ipetkov/crane";
    fenix = {
      url = "github:nix-community/fenix";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.rust-analyzer-src.follows = "";
    };
  };

  outputs = { self, nixpkgs, crane, fenix }:
    let
      systems = [ "x86_64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;

      mkPackagesForSystem = system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config = { allowUnfree = true; };
          };

          # Configure crane with stable Rust toolchain
          craneLib = (crane.mkLib pkgs).overrideToolchain
            fenix.packages.${system}.stable.toolchain;

          # Project source for crane
          src = pkgs.lib.cleanSourceWith {
            src = ./.;
            filter = path: type:
              (craneLib.filterCargoSources path type) ||
              (pkgs.lib.hasInfix "/templates/" path) ||
              (pkgs.lib.hasInfix "/static/" path) ||
              (pkgs.lib.hasSuffix "/templates" path) ||
              (pkgs.lib.hasSuffix "/static" path) ||
              (pkgs.lib.hasInfix "/migrations/" path) ||
              (pkgs.lib.hasSuffix "/migrations" path);
          };

          commonArgs = {
            inherit src;
            version = "0.1.0";
            strictDeps = true;
            pname = "aip";
            name = "aip";
            buildInputs = with pkgs; [
              openssl
              pkg-config
            ];
            nativeBuildInputs = with pkgs; [
              pkg-config
              openssl.dev
              # Add sqlx-cli for migrations
              sqlx-cli
            ];

            # Environment variables for OpenSSL
            OPENSSL_NO_VENDOR = 1;
            PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig";

            # Pass arguments to cargo build
            cargoExtraArgs = "--features sqlite --bin aip";
          };

          cargoArtifacts = craneLib.buildDepsOnly commonArgs;

          aip = craneLib.buildPackage (commonArgs // {
            inherit cargoArtifacts;
            doCheck = false;
            CARGO_PROFILE = "release";

            # Add migration step
            preBuild = ''
              # Create a temporary SQLite database for sqlx compile-time verification
              export DATABASE_URL="sqlite:///tmp/aip-build.db"
              sqlx database create
              sqlx migrate run --source migrations/sqlite
            '';
          });

          # Docker image for deployment
          aipImg = pkgs.dockerTools.buildImage {
            name = "aip";
            tag = "latest";
            copyToRoot = pkgs.buildEnv {
              name = "image-root";
              paths = [
                aip
                pkgs.cacert
              ];
              pathsToLink = [ "/bin" "/etc" ];
            };

            runAsRoot = ''
              #!${pkgs.runtimeShell}
              mkdir -p /tmp /app
              chmod 1777 /tmp
              chmod 755 /app
            '';

            config = {
              Cmd = [ "/bin/aip" ];
              Env = [
                "RUST_BACKTRACE=1"
                "RUST_LOG=info"
                "PORT=8080"
              ];
              ExposedPorts = {
                "8080/tcp" = {};
              };
            };
          };
        in
        {
          inherit aip aipImg;
          default = aip;
        };
    in
    {
      packages = forAllSystems mkPackagesForSystem;

      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          craneLib = (crane.mkLib pkgs).overrideToolchain
            fenix.packages.${system}.stable.toolchain;
        in
        {
          default = craneLib.devShell {
            packages = with pkgs; [
              nixpkgs-fmt
              nil
              dive
              flyctl
              sqlite
              postgresql
              sqlx-cli
            ];

            # Set up environment for development
            RUST_LOG = "info";
          };
        });
    };
}
