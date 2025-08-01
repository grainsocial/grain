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
      systems = [ "x86_64-linux" ];
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

          # Docker image for deployment
          darkroomImg = pkgs.dockerTools.buildImage {
            name = "darkroom";
            tag = "latest";
            contents = [
              darkroom
              pkgs.chromium
              pkgs.chromedriver
              pkgs.cacert
              pkgs.bash
            ];

            runAsRoot = ''
              #!${pkgs.runtimeShell}
              mkdir -p /tmp /app/chrome-profile
              chmod 1777 /tmp
              chmod 755 /app/chrome-profile

              # Create startup script
              cat > /start.sh << EOF
#!/bin/bash
set -e

echo "Starting ChromeDriver on port 9515..."
${pkgs.chromedriver}/bin/chromedriver --port=9515 --whitelisted-ips= &
CHROMEDRIVER_PID=\$!

# Give ChromeDriver time to start
sleep 2

echo "Starting Darkroom service..."
exec /bin/darkroom
EOF

              chmod +x /start.sh
            '';

            config = {
              Cmd = [ "/start.sh" ];
              Env = [
                "RUST_BACKTRACE=1"
                "RUST_LOG=debug"
                "CHROME_PATH=${pkgs.chromium}/bin/chromium"
                "CHROMEDRIVER_PATH=${pkgs.chromedriver}/bin/chromedriver"
                "BASE_URL=http://grain-darkroom.internal:8080"
              ];
              ExposedPorts = {
                "8080/tcp" = {};
              };
            };
          };
        in
        {
          inherit darkroom darkroomImg;
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
              chromium
            ];

            # Set up environment for development
            RUST_LOG = "debug";
            CHROME_PATH = "${pkgs.chromium}/bin/chromium";
          };
        });
    };
}
