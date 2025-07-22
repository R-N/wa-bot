// Required dependencies:
// npm install @qdrant/js-client-rest sentence-transformers axios uuid

import { QdrantClient } from '@qdrant/js-client-rest';
import { v5 as uuidv5 } from 'uuid';
import axios from 'axios';
import { pipeline } from '@xenova/transformers';
import { AffineClient } from './affine.js'; // Assume you have ported the AffineClient

export class KnowledgeBaseEngine {
  constructor(affineConfig, qdrantConfig) {
    this.collectionName = qdrantConfig.collectionName || 'knowledge_base';
    this.qclient = new QdrantClient({
      url: `http://${qdrantConfig.host}:${qdrantConfig.port}`,
    });
    this.aclient = new AffineClient(affineConfig);
    this.model = null;
  }

  async init(recreate=false) {
    this.model = await pipeline(
      'feature-extraction', 
      'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      // { config: { checkCompatibility: false } }
    );
    await this.aclient.getPropDefs();
    await this.aclient.getDocs();
    if (recreate)
      await this.setupQdrant();
  }

  async setupQdrant() {
    await this.qclient.recreateCollection(this.collectionName, {
      vectors: {
        size: 384,
        distance: 'Cosine',
      },
    });
    await this.indexDocuments();
  }

  async indexDocuments() {
    let count = 0;
    for (const doc of this.aclient.docs) {
      const props = await this.aclient.getDocProps(doc.id);
      if (!props.keys) continue;

      for (const key of JSON.parse(props.keys)) {
        const vector = Array.from((await this.model(key, { pooling: 'mean', normalize: true })).data);
        const pointId = uuidv5(`${doc.id}:${key}`, uuidv5.DNS);
        await this.qclient.upsert(this.collectionName, {
          points: [
            {
              id: pointId,
              vector,
              payload: {
                key,
                doc_id: doc.id,
              },
            },
          ],
        });
      }
      count++;
    }
    console.log(`Indexed ${count} documents with 'keys'`);
  }

  async query(text, limit = 3, scoreThreshold = 0.5) {
    const vector = Array.from((await this.model(text, { pooling: 'mean', normalize: true })).data);
    const results = await this.qclient.search(this.collectionName, {
      vector,
      limit,
      with_payload: true,
    });

    const hits = [];
    for (const hit of results) {
      if (hit.score > scoreThreshold) {
        const doc = await this.aclient.getDocument(hit.payload.doc_id);
        doc.score = hit.score;
        hits.push(doc);
      }
    }
    return hits;
  }
}

const main = async () => {
  const engine = new KnowledgeBaseEngine(
    {
      serverUrl: process.env.KB_SERVER_URL,
      email: process.env.KB_EMAIL,
      password: process.env.KB_PASSWORD,
      spaceId: process.env.KB_SPACE_ID,
    },
    {
      host: process.env.QDRANT_HOST,
      port: parseInt(process.env.QDRANT_PORT),
      collectionName: process.env.QDRANT_COLLECTION,
    }
  );

  await engine.init();
  await engine.indexDocuments();

  const hits = await engine.query("Apa itu nasi goreng?");
  console.log(JSON.stringify(hits, null, 2));
}
// main();
