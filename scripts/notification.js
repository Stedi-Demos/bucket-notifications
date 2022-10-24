import { BucketsClient, CreateBucketCommand, ReadBucketCommand, UpdateBucketCommand, ResourceNotFoundException } from "@stedi/sdk-client-buckets";
import settings from "./settings.js";

main();

async function main() {
  // The client provides access tot Stedi Buckets.
  const bucketsClient = new BucketsClient({
    // The region that hosts your bucket. At the moment, "us" is the only option.
    region: "us",

    // Read your API key from an environment variable.
    apiKey: process.env.STEDI_API_KEY
  });

  // The settings are shared between all helper scripts, so we read them from scripts/settings.js.
  const bucketName =  settings.inputBucketName;
  const functionName = settings.functionName;
  
  try {
    // If the bucket already exists, we want to add our notification to it without getting rid of
    // any notification that’s already on the bucket. So, let’s try to get the bucket.
    const readBucketCommand = new ReadBucketCommand({
      bucketName: bucketName
    });
    var readBucketResult = await bucketsClient.send(readBucketCommand);

    // If the bucket doesn’t exist, the client will raise an exception, which is handled in the
    // catch block a few lines down. 

    // Was our notification already added to the bucket previously?
    const notifications = readBucketResult.notifications;
    if (!notifications.functions.find(notification => notification.functionName === functionName)) {
      // No, add the notification.
      notifications.functions.push({ functionName: functionName });

      // Update the bucket.
      const updateBucketCommand = new UpdateBucketCommand({
        bucketName: bucketName,
        notifications: notifications
      });
      await bucketsClient.send(updateBucketCommand);
    }
  }
  catch (exception) {
    // Is the problem that the bucket doesn’t exist?
    if (exception instanceof ResourceNotFoundException) {
      // Yes, create the bucket with the notification.
      const createBucketCommand = new CreateBucketCommand({
        bucketName: bucketName,
        notifications: {
          functions: [{
            functionName: functionName
          }]
        }
      });
      await bucketsClient.send(createBucketCommand);
    }
    else {
      // No, something else went wrong. Nothing we can do about it. Just rethrow the exception.
      throw exception;
    }
  }
}