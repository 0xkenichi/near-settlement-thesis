// Puts the dashboard on NEAR testnet. First run: creates the account through the public testnet helper
// (free test NEAR) and deploys build/site.wasm. Later runs: redeploys the new wasm to the same account.
// Keys go to ./.near-credentials (git-ignored). Run: npm run build:site && npm run deploy:site
import fs from "node:fs";
import path from "node:path";
import { connect, keyStores, KeyPair, accountCreator } from "near-api-js";

const NETWORK = "testnet";
const ACCOUNT = process.env.SITE_ACCOUNT || "near-settlement-thesis.testnet";
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.resolve(".near-credentials"));
const near = await connect({ networkId: NETWORK, nodeUrl: "https://rpc.testnet.near.org", keyStore });

if (!(await keyStore.getKey(NETWORK, ACCOUNT))) {
  const kp = KeyPair.fromRandom("ed25519");
  await keyStore.setKey(NETWORK, ACCOUNT, kp);
  await new accountCreator.UrlAccountCreator(near.connection, "https://helper.testnet.near.org").createAccount(ACCOUNT, kp.getPublicKey());
  console.log("created", ACCOUNT);
}
const account = await near.account(ACCOUNT);
const out = await account.deployContract(fs.readFileSync("build/site.wasm"));
console.log("deployed:", `https://testnet.nearblocks.io/txns/${out.transaction.hash}`);
console.log("live at:", `https://${ACCOUNT.replace(/\.testnet$/, "")}.testnet.page`);
