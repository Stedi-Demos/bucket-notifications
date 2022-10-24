import { BucketsClient, DeleteBucketCommand } from "@stedi/sdk-client-buckets";
import { FunctionsClient, DeleteFunctionCommand } from "@stedi/sdk-client-functions";
import settings from "./settings.js"

main();

async function main() {
  // Create the client that provides access to Stedi Buckets.
  const bucketsClient = new BucketsClient({
    region: "us",
    apiKey: process.env.STEDI_API_KEY
  });

  // Create the client that provides access to Stedi Functions.
  const functionsClient = new FunctionsClient({
    region: "us",
    apiKey: process.env.STEDI_API_KEY
  });

  // Delete all resources in parallel.
  const results = await Promise.allSettled([
    bucketsClient.send(new DeleteBucketCommand({
      bucketName: settings.inputBucketName
    })),

    bucketsClient.send(new DeleteBucketCommand({
      bucketName: settings.outputBucketName
    })),

    functionsClient.send(new DeleteFunctionCommand({
      functionName: settings.functionName
    }))
  ]);

  // Check if anything went wrong while deleting the resources.
  for (let result of results) {
    if (
      result.status === "rejected" &&
      result.reason.name !== "ResourceNotFoundException"  // If the command failed because the
                                                          // resource doesn’t exist, ignore it.
                                                          // Gone is gone.
    ) {
      console.error(result.reason);
    }
  }
}