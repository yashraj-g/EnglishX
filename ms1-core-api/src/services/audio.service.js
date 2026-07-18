'use strict';

/**
 * AudioService — generates presigned S3 GET URLs for user audio recordings.
 *
 * Presigned URLs are generated on-demand (1-hour TTL) so the S3 bucket
 * can remain completely private — no public ACLs needed.
 *
 * Requires: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
 */
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;
  const { region, accessKeyId, secretAccessKey } = config.aws;
  if (!accessKeyId || !secretAccessKey || accessKeyId === 'YOUR_AWS_ACCESS_KEY_ID') {
    return null;
  }
  s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3Client;
}

const audioService = {
  /**
   * Generate a 1-hour presigned GET URL for a single S3 key.
   * Returns null if AWS is not configured or key is falsy.
   */
  async getPresignedUrl(s3Key) {
    if (!s3Key) return null;
    const client = getS3Client();
    if (!client) return null;
    try {
      const command = new GetObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: s3Key,
      });
      const url = await getSignedUrl(client, command, { expiresIn: 3600 });
      return url;
    } catch (err) {
      console.error(`[AudioService] Failed to generate presigned URL for ${s3Key}:`, err.message);
      return null;
    }
  },

  /**
   * Batch-generate presigned URLs for an array of { turnIndex, s3Key } objects.
   * Returns an array of { turnIndex, presignedUrl } — entries where URL generation
   * failed have presignedUrl: null.
   */
  async getSessionAudioUrls(audioKeys) {
    if (!Array.isArray(audioKeys) || audioKeys.length === 0) return [];
    const results = await Promise.all(
      audioKeys.map(async ({ turnIndex, s3Key }) => ({
        turnIndex,
        s3Key,
        presignedUrl: await audioService.getPresignedUrl(s3Key),
      }))
    );
    return results;
  },
};

module.exports = audioService;
