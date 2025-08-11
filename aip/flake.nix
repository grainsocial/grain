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
            cargoExtraArgs = "--no-default-features --features embed,sqlite --bin aip";
          };

          cargoArtifacts = craneLib.buildDepsOnly commonArgs;

          aip = craneLib.buildPackage (commonArgs // {
            inherit cargoArtifacts;
            doCheck = false;
            CARGO_PROFILE = "release";

            # Add migration step
            preBuild = ''
              # Create a temporary SQLite database for sqlx compile-time verification
              export DATABASE_URL="sqlite:///tmp/aip.db"
              sqlx database create
              sqlx migrate run --source migrations/sqlite
            '';
          });

          # Migration runner script
          migrationRunner = pkgs.writeShellScriptBin "run-migrations" ''
            set -e
            if [ -z "$DATABASE_URL" ]; then
              echo "DATABASE_URL environment variable is required"
              exit 1
            fi
            
            # Determine migration source based on database type
            if [[ "$DATABASE_URL" == sqlite* ]]; then
              MIGRATION_SOURCE="migrations/sqlite"
            elif [[ "$DATABASE_URL" == postgres* ]]; then
              MIGRATION_SOURCE="migrations/postgres"
            else
              echo "Unsupported database type in DATABASE_URL: $DATABASE_URL"
              exit 1
            fi
            
            echo "Running migrations from $MIGRATION_SOURCE against $DATABASE_URL"
            ${pkgs.sqlx-cli}/bin/sqlx migrate run --source "$MIGRATION_SOURCE"
          '';

          # Docker image for deployment
          aipImg = pkgs.dockerTools.buildImage {
            name = "aip";
            tag = "latest";
            copyToRoot = pkgs.buildEnv {
              name = "image-root";
              paths = [
                aip
                migrationRunner
                pkgs.cacert
                pkgs.coreutils
                pkgs.bash
                pkgs.sqlx-cli
              ];
              pathsToLink = [ "/bin" "/etc" ];
            };

            runAsRoot = ''
              #!${pkgs.runtimeShell}
              mkdir -p /tmp
              chmod 1777 /tmp
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
          inherit aip aipImg migrationRunner;
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
