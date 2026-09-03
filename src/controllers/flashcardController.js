const Vocabulary = require('../models/Vocabulary');
const AppError = require('../utils/AppError');

/** SM-2 spaced repetition update */
function applySm2(card, quality) {
  const q = Math.max(0, Math.min(5, Number(quality)));
  let { easeFactor, interval, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  const nextReviewAt = new Date(Date.now() + interval * 86400000);
  return { easeFactor, interval, repetitions, nextReviewAt, lastReviewedAt: new Date() };
}

async function dueCards(req, res, next) {
  try {
    const now = new Date();
    const cards = await Vocabulary.find({
      userId: req.user._id,
      nextReviewAt: { $lte: now },
    })
      .sort({ nextReviewAt: 1 })
      .limit(40);
    res.json({ success: true, cards, count: cards.length });
  } catch (err) {
    next(err);
  }
}

async function reviewCard(req, res, next) {
  try {
    const card = await Vocabulary.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!card) throw new AppError('Card not found', 404);

    const updates = applySm2(card, req.body.quality);
    Object.assign(card, updates);
    await card.save();

    req.user.bumpStreak();
    await req.user.save();

    res.json({ success: true, card, streak: req.user.streak });
  } catch (err) {
    next(err);
  }
}

module.exports = { dueCards, reviewCard };
