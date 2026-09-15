/**
 * The day's calorie and macro targets, from the profile.
 *
 * One place, because there were two: the dashboard's getRecommendedCalories and
 * MetricScreen's calorieGoal were copies of the same Mifflin-St Jeor formula,
 * "kept in sync" by a comment. A change to one would have left the calories
 * ring and the calories history disagreeing about the same day.
 *
 * The macros used to ignore the goal entirely — 2 g of protein per kg whether
 * you were cutting or bulking. They now follow it:
 *
 *   goal            protein     fats
 *   lose_weight     2.2 g/kg    25% of calories   protein holds muscle in a deficit
 *   build_muscle    2.0 g/kg    25%
 *   gain_strength   1.8 g/kg    30%               more energy per meal, fewer grams
 *   maintain        1.6 g/kg    30%
 *
 * Carbs take whatever calories are left. Fats never drop below 0.6 g/kg — the
 * floor under which a low-calorie target would otherwise push them.
 */

const KCAL = { protein: 4, carbs: 4, fats: 9 };

const PLANS = {
  lose_weight:   { proteinPerKg: 2.2, fatShare: 0.25, adjust: -500 },
  build_muscle:  { proteinPerKg: 2.0, fatShare: 0.25, adjust: 300 },
  gain_strength: { proteinPerKg: 1.8, fatShare: 0.3, adjust: 300 },
  maintain:      { proteinPerKg: 1.6, fatShare: 0.3, adjust: 0 },
};

const MIN_CALORIES = 1200;
const MIN_FAT_PER_KG = 0.6;
const DEFAULT_WEIGHT = 70;

const planFor = (goal) => PLANS[goal] || PLANS.maintain;

const weightOf = (profile) => parseFloat(profile?.weight) || DEFAULT_WEIGHT;

/** Mifflin-St Jeor, an activity multiplier from workouts per week, then the goal. */
export function calorieTarget(profile) {
  if (!profile) return 2000;

  const weight = weightOf(profile);
  const height = parseFloat(profile.height) || 170;
  const age = parseInt(profile.age, 10) || 25;
  const workouts = parseInt(profile.workouts_per_week, 10) || 3;

  const bmr = 10 * weight + 6.25 * height - 5 * age + (profile.sex === 'F' ? -161 : 5);
  const multiplier = workouts >= 6 ? 1.725 : workouts >= 3 ? 1.55 : workouts >= 1 ? 1.375 : 1.2;

  return Math.max(MIN_CALORIES, Math.round(bmr * multiplier + planFor(profile.goal).adjust));
}

/** Grams of protein, carbs and fats for the day. */
export function macroTargets(profile, calories = calorieTarget(profile)) {
  const weight = weightOf(profile);
  const plan = planFor(profile?.goal);

  const protein = Math.round(weight * plan.proteinPerKg);
  const fats = Math.round(Math.max((calories * plan.fatShare) / KCAL.fats, weight * MIN_FAT_PER_KG));
  const carbs = Math.max(0, Math.round((calories - protein * KCAL.protein - fats * KCAL.fats) / KCAL.carbs));

  return { protein, carbs, fats };
}
