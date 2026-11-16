# Lexicons

The schemas grain's records and XRPC methods are written to. `social.grain.*`
is grain's own; the rest (`app.bsky`, `com.atproto`, ...) are copies of
other publishers', kept so the types and the validation have them.

`social.grain.unspecced.*`, and the admin methods `harness/lexicons.mjs`
lists as `UNSERVED`, stay published as they are, but grain-serve does not
answer them.

## Methods under a record's name

`social.grain.group` is a space declaration, and methods live under the same
name: `social.grain.group.createGroup`. An NSID's last segment is its name and
the rest its authority, so the declaration resolves at `_lexicon.grain.social` and
the methods at `_lexicon.group.grain.social`, and the files sit side by side,
`group.json` beside `group/`, as `group/defs.json` and the group's records
already do.
