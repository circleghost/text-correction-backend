import { Router } from 'express';
import { textCorrectionController } from '../controllers/textCorrectionController';

const router = Router();

/**
 * @swagger
 * /api/v1/text/correct:
 *   post:
 *     summary: Correct a single text
 *     tags: [Text Correction]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text to be corrected
 *               options:
 *                 type: object
 *                 properties:
 *                   language:
 *                     type: string
 *                     default: zh-TW
 *                   preserveFormatting:
 *                     type: boolean
 *                     default: true
 *                   correctionLevel:
 *                     type: string
 *                     enum: [basic, standard, advanced]
 *                     default: standard
 *     responses:
 *       200:
 *         description: Text correction completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     correctedText:
 *                       type: string
 *                     corrections:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TextCorrection'
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalChars:
 *                           type: number
 *                         correctionCount:
 *                           type: number
 *                         processingTime:
 *                           type: string
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal server error
 */
router.post('/correct', (req, res) => {
  textCorrectionController.correctText(req, res);
});

/**
 * @swagger
 * /api/v1/text/batch-correct:
 *   post:
 *     summary: Correct multiple paragraphs in batch
 *     tags: [Text Correction]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paragraphs
 *             properties:
 *               paragraphs:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique identifier for the paragraph
 *                     text:
 *                       type: string
 *                       description: Text content of the paragraph
 *               options:
 *                 type: object
 *                 properties:
 *                   language:
 *                     type: string
 *                     default: zh-TW
 *                   concurrent:
 *                     type: number
 *                     default: 3
 *                     description: Number of concurrent processing requests
 *     responses:
 *       200:
 *         description: Batch correction completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           paragraphId:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [completed, error]
 *                           correctedText:
 *                             type: string
 *                           corrections:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/TextCorrection'
 *                           processingTime:
 *                             type: string
 *                           error:
 *                             type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalParagraphs:
 *                           type: number
 *                         completedCount:
 *                           type: number
 *                         totalCorrections:
 *                           type: number
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Internal server error
 */
router.post('/batch-correct', (req, res) => {
  textCorrectionController.batchCorrectParagraphs(req, res);
});

/**
 * @swagger
 * components:
 *   schemas:
 *     TextCorrection:
 *       type: object
 *       properties:
 *         original:
 *           type: string
 *           description: Original text that was corrected
 *         corrected:
 *           type: string
 *           description: Corrected text
 *         position:
 *           type: object
 *           properties:
 *             start:
 *               type: number
 *               description: Start position of the correction
 *             end:
 *               type: number
 *               description: End position of the correction
 *         type:
 *           type: string
 *           enum: [spelling, grammar, punctuation, style]
 *           description: Type of correction made
 *         confidence:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           description: Confidence score of the correction
 */

export default router;