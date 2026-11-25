import { pingOnshape } from './onshapeClient.js';

async function main() {
  try {
    const result = await pingOnshape();
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

void main();
