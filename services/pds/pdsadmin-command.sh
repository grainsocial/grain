# pdsadmin is a tool for managing the Personal Data Store (PDS) server.
# But at the end of the day, it's just a bash script that makes curl requests
# Even worse, it does all sorts of annoying checks that don't apply to OSX
# So I have reversed engineered the requests I cared about and put them here

# You can copy and paste these into your terminal,
# Remove the underscores before the curl command
# Replace the variables with your own values

PDS_ENV_FILE=${PDS_ENV_FILE:-".env"}
source "${PDS_ENV_FILE}"

export DID=""

# make an invite code
# curl \
#     --fail \
#     --silent \
#     --show-error \
#     --request POST \
#     --header "Content-Type: application/json" \
#     --user "admin:${PDS_ADMIN_PASSWORD}" \
#     --data '{"useCount": 1}' \
#     "https://${PDS_HOST}/xrpc/com.atproto.server.createInviteCode"

# delete an account
# curl \
#     --fail \
#     --silent \
#     --show-error \
#     --request POST \
#     --header "Content-Type: application/json" \
#     --user "admin:${PDS_ADMIN_PASSWORD}" \
#     --data "{\"did\": \"${DID}\"}" \
#     "https://${PDS_HOST}/xrpc/com.atproto.admin.deleteAccount"
