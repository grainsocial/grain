{
  description = "Darkroom service for Grain";

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
      # Support multiple systems
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;

      mkPackagesForSystem = system:
        let
          pkgs = import nixpkgs { inherit system; };

          # Configure crane with stable Rust toolchain
          craneLib = (crane.mkLib pkgs).overrideToolchain
            fenix.packages.${system}.stable.toolchain;

          # Project source for crane
          src = pkgs.lib.cleanSourceWith {
            src = ./.;
            filter = path: type:
              (craneLib.filterCargoSources path type);
          };

          commonArgs = {
            inherit src;
            version = "0.1.0";
            strictDeps = true;
            pname = "darkroom";
            name = "darkroom";
            buildInputs = with pkgs; [
              openssl
              pkg-config
            ];
            nativeBuildInputs = with pkgs; [
              pkg-config
              openssl.dev
            ];

            # Environment variables for OpenSSL
            OPENSSL_NO_VENDOR = 1;
            PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig";
          };

          cargoArtifacts = craneLib.buildDepsOnly commonArgs;

          darkroom = craneLib.buildPackage (commonArgs // {
            inherit cargoArtifacts;
            doCheck = false;
            CARGO_PROFILE = "release";
          });

          # Docker image for deployment (only build for Linux)
          darkroomImg = if pkgs.stdenv.isLinux then pkgs.dockerTools.buildLayeredImage {
            name = "darkroom";
            tag = "latest";
            contents = [
              darkroom
              pkgs.chromium
              pkgs.cacert
            ];

            runAsRoot = ''
              #!${pkgs.runtimeShell}
              mkdir -p /tmp /app/chrome-profile
              chmod 1777 /tmp
              chmod 755 /app/chrome-profile
            '';

            config = {
              Cmd = [ "/bin/darkroom" ];
              Env = [
                "CHROME_PATH=${pkgs.chromium}/bin/chromium"
              ];
              ExposedPorts = {
                "8080/tcp" = {};
              };
            };
          } else null;
        in
        if system == "x86_64-linux" || system == "aarch64-linux" then {
          inherit darkroom darkroomImg;
          default = darkroom;
        } else {
          inherit darkroom;
          default = darkroom;
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
            ] ++ (if pkgs.stdenv.isLinux then [ chromium ] else []);

            # Set up environment for development
            RUST_LOG = "debug";
          } // (if pkgs.stdenv.isLinux then {
            CHROME_PATH = "${pkgs.chromium}/bin/chromium";
          } else {});
        });
    };
}
