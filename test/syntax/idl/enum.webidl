enum MealType { "rice", "noodles", "other" };

interface Meal {
  attribute MealType type;
  attribute float size;     // in grams

  undefined initialize(MealType type, float size);
};

enum _AltMealType { "rice", "noodles", "other", };
