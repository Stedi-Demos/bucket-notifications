import { BucketsClient, DeleteBucketCommand, ListObjectsCommand, DeleteObjectCommand } from "@stedi/sdk-client-buckets";
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
    deleteBucket(bucketsClient, settings.inputBucketName),
    deleteBucket(bucketsClient, settings.outputBucketName),
    functionsClient.send(new DeleteFunctionCommand({
      functionName: settings.functionName
    }))
  ]);

  // Check if anything went wrong while deleting the resources.
  for (let result of results) {
    if (
      result.status === "rejected" &&
      result.reason.name !== "ResourceNotFoundException" &&  // If the command failed because the
      result.reason.name !== "NoSuchBucket"                  // resource doesn’t exist, ignore it.
                                                             // Gone is gone.
    ) {
      console.error(result.reason);
    }
  }
}

async function deleteBucket(bucketsClient, bucketName) {
  let pageToken = undefined;
  do {
    // Get a list of all the files in the bucket.
    const listObjectsCommand = new ListObjectsCommand({
      bucketName: bucketName,
      pageToken: pageToken
    });
    const listObjectsResult = await bucketsClient.send(listObjectsCommand);

    // Delete all the files in parallel.
    if (listObjectsResult.items) {
      await Promise.allSettled(
        listObjectsResult.items.map(item => bucketsClient.send(new DeleteObjectCommand({
          bucketName: bucketName,
          key: item.key
        })))
      );
    }

    // The list of files is paged, so go to the next page if necessary.
    pageToken = listObjectsResult.nextPageToken;
  } while (pageToken !== undefined);

  // Delete the bucket.
  await bucketsClient.send(new DeleteBucketCommand({
    bucketName: bucketName
  }));
}