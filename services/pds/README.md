# Setting up a PDS

1. Customizing _fly.toml_
   - You should replace values `app`, `primary_region`, `env.PDS_HOSTNAME` to
     values that will make sense for your installation.
     - `app` controls the name of the project on fly.io
     - `primary_region` controls where the app will be deployed globally, `iad`
       is in Northern Virginia (USA)
     - `[env]`, `PDS_HOSTNAME` should make the URL from where you plan to reach
       the application, so for example, if you're planning to add a DNS entry to
       reach your PDS from `my-pds.my-site.com`, then, use that as the value
       here
2. Generate the necessary secret values for your PDS
   > 🚧 All of these values are super secret, do not share them!
   >
   > Make sure you have them written down somewhere because fly.io will never
   > let you see them again
   1. _PDS_JWT_SECRET_: `openssl rand --hex 16`
   2. _PDS_ADMIN_PASSWORD_: `openssl rand --hex 16`
   3. _PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX_:
      `openssl ecparam --name secp256k1 --genkey --noout --outform DER | tail --bytes=+8 | head --bytes=32 | xxd --plain --cols 32`
3. Create the project in fly.io
   1. Run `fly launch --no-deploy`, this will create the project on fly without
      deploying it. You need to make some changes ahead of an initial deployment
   2. Create the volume that you specified earlier, make sure to choose the
      primary_region as the region for your volume `fly volume create pdsdata`
   3. Apply the secrets you generated earlier
      `fly secrets set PDS_JWT_SECRET=secret PDS_ADMIN_PASSWORD=secret PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX=secret`
   4. Deploy the app using `fly deploy`
   > 🚧 This should create only one machine, make sure using `fly m ls`
   >
   > If you have more than one machine scale down using `fly scale count 1`
   5. Test your PDS: You can do this quickly by visitng
      `https://<your-app-name>.fly.dev/xrpc/com.atproto.sync.listRepos`, at this
      point you should see a response like this:
   ```json
   { "repos": [] }
   ```
4. Setup your DNS

- You need to create an entry for your PDS's hostname in the DNS console you use
  for your domain name: `pds.example.com`

> 🚧 You need to create an entry that allows you to map handles to the pds
>
> The handle `username.pds.example.com` needs be able to resolve, so your PDS
> should also be available at `username.pds.example.com`. If you don't do this,
> other atproto services can't resolve the handle and you get `Invalid Handle`
> everywhere you go

- Now you should be able to reach your PDS at
  `https://pds.example.com/xrpc/com.atproto.sync.listRepos`

5. Bonus, Setting up emails: Blue Sky will ask you to verify your email, but,
   without having a mail service setup, you'll never be able to get the
   confirmation code! Follow the official PDS guide on setting up email
   services, it covers the topic fully:
   [link](https://github.com/bluesky-social/pds?tab=readme-ov-file#setting-up-smtp)
   > 🚧 Remember: You can add secrets to your fly service using
   >
   > `fly secrets set KEY1=VALUE1 KEY2=VALE2 ...`

# Credits

[keaysma](https://github.com/keaysma/pds-fly.io-template)
