import { io } from "socket.io-client";
import { writeFileSync } from "fs";
import * as Y from "yjs";
import { Buffer } from "buffer";

const PROP_ATTRS = ['name', 'id', 'type', 'isDeleted'];
const BASIC_PROPS = ["id", "primaryMode", "updatedBy", "createdBy"];

export class AffineClient {
  constructor({
    serverUrl,
    cookies="",
    clientVersion = "0.22.4",
    email=null,
    password=null,
    spaceId=null,
  }) {
    this.serverUrl = serverUrl;
    this.clientVersion = clientVersion;
    this.cookies = cookies;
    if (email && password){
      this.login(email, password);
    }
    if (spaceId){
      this.setSpace(spaceId);
    }
  }

  registerEvents() {
    this.socket.on("connect_error", (err) => {
      console.error("[-] Connection error:", err);
    });

    this.socket.on("disconnect", () => {
      console.log("[-] Disconnected");
    });

    this.socket.on("space:broadcast-doc-update", (message) => {
      console.log("[Update] Doc update received:", message);
    });
  }

  isEmptyUpdate(binary) {
    return (
      binary.byteLength === 0 ||
      (binary.byteLength === 2 && binary[0] === 0 && binary[1] === 0)
    );
  }

  async joinSpace(spaceId, spaceType="workspace") {
    const res = await this.socket.emitWithAck("space:join", {
      spaceType: spaceType,
      spaceId: spaceId,
      clientVersion: this.clientVersion,
    });
    this.setSpace(spaceId, spaceType);
    console.log("[+] space:join response:", res);
  }

  setSpace(spaceId, spaceType="workspace") {
    this.spaceType = spaceType;
    this.spaceId = spaceId;
  }

  async get(docId) {
    const doc = new Y.Doc();
    let done = false;
    let stateVector = Buffer.from(Y.encodeStateVector(doc)).toString("base64");

    while (!done) {
      stateVector = Buffer.from(Y.encodeStateVector(doc)).toString("base64");

      const res = await this.socket.emitWithAck("space:load-doc", {
        spaceType: this.spaceType,
        spaceId: this.spaceId,
        docId,
        stateVector,
      });

      if (res.error) {
        throw new Error(res.error.message);
      }

      if (res.data?.missing) {
        const missingBin = Buffer.from(res.data.missing, "base64");
        Y.transact(doc, () => {
          Y.applyUpdate(doc, missingBin);
        });

        if (this.isEmptyUpdate(missingBin) || stateVector == res.data.state) {
          break;
        } else {
          stateVector = res.data.state;
          console.log(
            `[+] Applied ${missingBin.length} bytes of updates. State: ${res.data.state}`
          );
        }
      } else {
        break;
      }
    }
    console.log("[+] No more missing updates, document fully synced");

    return doc;
  }
  
  async get(docId) {
    const url = `${this.serverUrl}/api/workspaces/${this.spaceId}/docs/${docId}`;
  
    const res = await fetch(url, {
      headers: {
        cookie: this.cookies,
      },
    });
  
    if (!res.ok) {
      throw new Error(`Failed to fetch document. Status: ${res.status}`);
    }
  
    const buf = await res.arrayBuffer();
    // const update = new Uint8Array(buf);
    const update = Buffer.from(buf, "base64");
  
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);
  
    return doc;
  }
  
  async getDocument(docId){
    let doc = await this.get(docId);
    doc = this.parseDocument(doc);
    doc.metadata.id = docId;
    doc.metadata.url = this.getDocUrl(docId);
    doc.metadata = {
      ...doc.metadata,
      ...await this.getDocProps(docId)
    };
    return doc;
  }

  extractBlocks(doc) {
    const blocks = doc.getMap("blocks");
    const blockList = {};

    if (blocks && blocks._map) {
      for (const key of blocks._map.keys()) {
        const block = blocks.get(key);
        if (block instanceof Y.Map) {
          blockList[key] = block.toJSON();
        }
      }
    }
    return blockList;
  }

  renderDocument(doc) {
    const blocks = this.extractBlocks(doc);
    const root = Object.values(blocks).find(
      (b) => b && b["sys:flavour"] === "affine:page"
    );
    if (!root) throw new Error("No affine:page block found");

    return this.renderBlock(root, blocks);
  }

  renderBlock(block, blocks) {
    let md = "";
    if (!block) return md;

    switch (block["sys:flavour"]) {
      case "affine:page":
        md += `# ${block["prop:title"]}\n\n`;
        md += this.renderChildren(block, blocks);
        break;

      case "affine:note":
        md += this.renderChildren(block, blocks);
        break;

      case "affine:list":
        if (block["prop:order"]) md += `${block["prop:order"]}. `;
        if (block["prop:text"]) md += `${block["prop:text"]}\n`;
        break;

      case "affine:paragraph":
        if (block["prop:text"]) md += `${block["prop:text"]}\n\n`;
        break;

      case "affine:image":
        const sourceId = block["prop:sourceId"];
        const caption = block["prop:caption"] || "";
        const blobUrl = this.getBlobUrl(sourceId);
        md += `![${caption}](${blobUrl})\n\n`;
        break;

      default:
        break;
    }

    return md;
  }

  renderChildren(parentBlock, blocks) {
    return (parentBlock["sys:children"] || [])
      .map((childId) => this.renderBlock(blocks[childId], blocks))
      .join("");
  }

  getBlobUrl(blobId) {
    return `${this.serverUrl}/api/workspaces/${this.spaceId}/blobs/${blobId}`;
  }

  async downloadBlob(blobId) {
    const blobUrl = this.getBlobUrl(blobId);

    const res = await fetch(blobUrl, {
      headers: { cookie: this.cookies },
    });

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = res.headers.get("content-type")?.split("/")[1] || "bin";
    const fileName = `${blobId}.${ext}`;

    writeFileSync(fileName, buffer);
  }

  async login(email, password) {
    const url = `${this.serverUrl}/api/auth/sign-in?native=true`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });

    if (!res.ok) {
      throw new Error(`Login failed with status ${res.status}`);
    }

    const rawCookies = res.headers.getSetCookie();
    if (!rawCookies || rawCookies.length === 0) {
      throw new Error("No cookies received during login.");
    }

    // Keep only the cookie values (strip attributes like Path, HttpOnly, etc.)
    this.cookies = rawCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");

    console.log("[+] Login successful, received cookies:", this.cookies);
  }
  connect() {
    this.socket = io(this.serverUrl, {
      transports: ["websocket"],
      extraHeaders: {
        Cookie: this.cookies,
      },
    });

    this.registerEvents();
  }
  parseDocument(doc) {
    const allBlocks = this.extractBlocks(doc);
    const blobs = {};
    const blocks = {};
    let metadata = {};
  
    // Find root page block
    const root = Object.values(allBlocks).find(
      (b) => b && b["sys:flavour"] === "affine:page"
    );
    if (!root) throw new Error("No affine:page block found");
  
    // Process blocks
    for (const [blockId, block] of Object.entries(allBlocks)) {
      blocks[blockId] = block["sys:flavour"] || "unknown";
  
      if (block["sys:flavour"] === "affine:image" && block["prop:sourceId"]) {
        blobs[blockId] = this.getBlobUrl(block["prop:sourceId"], this.spaceId);
      }
    }
  
    // Extract metadata
    metadata = {
      guid: doc["guid"],
      title: root["prop:title"],
    };
  
    // Render markdown content
    const content = this.renderBlock(root, allBlocks, this.spaceId);
  
    return {
      metadata,
      // blocks,
      content,
      blobs,
    };
  }
  async getDocs() {
    const graphqlEndpoint = `${this.serverUrl}/graphql`;
    
    const query = `
      query getAllDocIds($workspaceId: String!) {
        workspace(id: $workspaceId) {
          docs(pagination: { offset: 0, first: 1000 }) {
            edges {
              node {
                id
                mode
              }
            }
          }
        }
      }
    `;
  
    const body = JSON.stringify({
      query,
      variables: { workspaceId: this.spaceId },
    });
  
    const res = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: this.cookies,
      },
      body,
    });
  
    if (!res.ok) {
      throw new Error(`GraphQL request failed with status ${res.status}`);
    }
  
    const json = await res.json();
    if (json.errors) {
      console.error(json.errors);
      throw new Error("GraphQL returned errors");
    }
  
    const edges = json.data.workspace.docs.edges || [];
    const docs = edges.map((e) => e.node);
    this.docs = docs;
    return docs;
  }
  
  async getPropDefs(){
    const doc = await this.get(`db\$${this.spaceId}\$docCustomPropertyInfo`);
    const propDefs = [];
    for (const propId of doc.share.keys()) {
      const propMap = doc.getMap(propId);
      if (propMap instanceof Y.Map) {
        const prop = PROP_ATTRS.reduce((acc, key) => {
          acc[key] = propMap.get(key);
          return acc;
        }, {});
        propDefs.push(prop);
      }
    }
    this.propDefs = propDefs;
  }

  async getProps(){
    const doc = (await this.get(`db\$${this.spaceId}\$docProperties`));
    const allProps = Array.from(doc.share.keys()).reduce((acc0, docId0) => {
      const dp = doc.getMap(docId0);
      let props = this.propDefs.reduce((acc, prop) => {
        const val = dp.get(`custom:${prop.id}`);
        if (typeof val !== 'undefined') {
          acc[prop.name] = val;
        }
        return acc;
      }, {});
      props = BASIC_PROPS.reduce((acc, prop) => {
        acc[prop] = dp.get(prop);
        return acc;
      }, props);
      acc0[docId0] = props;
      return acc0;
    }, {});
    this.props = allProps;
    return allProps;
  }
  
  async getDocProps(docId=null, fetch=true){
    let props;
    if(fetch){
      props = await this.getProps();
    }else{
      props = this.props;
    }
    if (docId){
      return props[docId];
    }
    return props;
  }

  getDocUrl(docId){
    return `${this.serverUrl}/workspace/${this.spaceId}/${docId}`;
  }
}

const main = async () => {
  const client = new AffineClient({
    serverUrl: process.env.KB_SERVER_URL,
  });
  
  await client.login(process.env.KB_EMAIL, process.env.KB_PASSWORD);
  await client.setSpace(process.env.KB_SPACE_ID);
  await client.getPropDefs();
  const docs = await client.getDocs();
  console.log(docs);
  const doc = await client.getDocument("Fv_MpzfZIUwd0TIn5ZKnt");
  console.log(doc);
}

// main();
