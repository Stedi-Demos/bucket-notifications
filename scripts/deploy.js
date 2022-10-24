import dotenv from "dotenv";
import esbuild from "esbuild";
import { rm, mkdir, readFile } from "fs/promises";
import { execFileSync } from "child_process";
import JSZip from "jszip"
import { FunctionsClient, CreateFunctionCommand, UpdateFunctionCommand, ResourceConflictException } from "@stedi/sdk-client-functions";

// Get the name of the function from the settings file.
import settings from "./settings.js"
const functionName = settings.functionName;
if (!functionName) {
  console.error("Run scripts/setup.js first.");
}

// For a detailed explanation of the deployment script, see:
// https://github.com/Stedi-Demos/deploy-functions-with-the-sdk

const timeout = 900;
const entryPoint = "src/handler.js";

main();

async function main() {
  await createBuildDirectory();
  installDependencies();
  await bundle();
  const zip = await zipPackage();
  await deploy(zip);
}

async function createBuildDirectory() {
  await rm("build", { recursive: true, force: true });
  await mkdir("build");
}

function installDependencies() {
  execFileSync("npm", [ "install" ]);
}

async function bundle() {
  await esbuild.build({
    bundle: true,
    entryPoints: [ entryPoint ],
    platform: "node",
    target: "node16",
    outfile: "build/index.mjs",
    format: "esm",
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    minify: true,
    sourcemap: true
  });
}

async function zipPackage() {
  var zip = new JSZip();

  zip.file("index.mjs", await readFile("build/index.mjs"));
  zip.file("index.mjs.map", await readFile("build/index.mjs.map"));

  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: {
      level: 9
    }
  });
}

async function deploy(zip) {
  const functionsClient = new FunctionsClient({
    region: "us",
    apiKey: process.env.STEDI_API_KEY
  });

  const environmentVariables = dotenv.config().parsed;

  try {
    const createFunctionCommand = new CreateFunctionCommand({
      functionName: functionName,
      package: zip,
      timeout: timeout,
      environmentVariables: environmentVariables
    });
    await functionsClient.send(createFunctionCommand);
  }
  catch (exception) {
    if (exception instanceof ResourceConflictException) {
      const updateFunctionCommand = new UpdateFunctionCommand({
        functionName: functionName,
        package: zip,
        timeout: timeout,
        environmentVariables: environmentVariables
      });
      await functionsClient.send(updateFunctionCommand);
    }
    else {
      throw exception;
    }
  }
}