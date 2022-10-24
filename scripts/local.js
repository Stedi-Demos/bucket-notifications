import { handler } from "../src/handler.js";
import settings from "./settings.js"

// Make the environment variables in the .env file available to the function. These are the same
// environment variables that the function will see when running on Stedi.
import dotenv from "dotenv";
dotenv.config({ override: true });

// An example notification to test with. This resembles a notification as Stedi Buckets would send
// it to the function, although an actual notification contains more data. This example only
// contains the fields the function needs. For a complete example, see:
// https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html#notification-content-structure-examples
const event = {
  "Records": [{
    // The event name tells you what happened. ObjectCreated:Put means that a file was added to the
    // bucket. At the moment, that’s the only event Stedi Buckets will notify you about, but in the
    // future, there may be others.
    "eventName":"ObjectCreated:Put",
    "s3": {
      "bucket": {
        // The name of the bucket that sends the notification. Even though we’re running a local
        // test, the function will read from an actual bucket hosted on Stedi. The function will
        // fail if the bucket doesn’t exist.
        "name": settings.inputBucketName
      },
      "object": {
        // The name of the file that has been uploaded. Since you invoke this test manually, not by
        // uploading a file, the file should already be in the bucket when you start the test or the
        // function will fail.
        "key": "local.txt"
      }
    }
  }]
};

// Call the function.
handler(event);