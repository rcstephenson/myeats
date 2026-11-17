# Nutrition companion app: spec questionnaire

Fill in each **Answer** block. Each question has a suggested default in brackets; writing `default` there is fine. Answers already given in chat are filled in.

---

## 1. How it relates to trakr

### 1.1 Repo and stack
Separate repo and app with the same stack as trakr (React 18, strict TypeScript, Tailwind, Dexie/IndexedDB, Zod, Recharts, local-first PWA on GitHub Pages)?
*[Default: yes, separate repo with the same stack and conventions]*

**Answer:** Yes, separate repo with the same stack and conventions.

### 1.2 Shared data
Should the apps share any data (e.g. showing the day's workout, sharing weigh-ins with trakr's session `bodyweight`)?
*[Default: independent at first]*

**Answer:** Keep the apps separate.

### 1.3 Sync
Optional Dexie Cloud sync with its own database, or JSON backup only?
*[Default: optional sync with its own database, plus JSON backup]*

**Answer:** A separate Dexie Cloud database, if it can be had for free alongside the existing trakr database. *(To verify: whether Dexie Cloud's free tier allows a second database.)*

### 1.4 Training-day vs rest-day goals
Different goals on training days and rest days?
*[Default: no, one daily goal]*

**Answer:** No, one daily goal.

---

## 2. Look and feel

### 2.1 Visual style
Cronometer style, trakr's "Signal" with Cronometer's layout, or a blend?
*[Default: blend]*

**Answer:** Signal with Cronometer's layout, with a different accent colour from lime.

### 2.2 Accent colour
What accent colour would you like instead of lime? (Should individual macros also get their own colours, like Cronometer?)
*[Default: one accent for "current" states, plus a distinct colour per macro in bars and charts]*

**Answer:**

### 2.3 Themes
Light and dark themes like trakr?
*[Default: yes]*

**Answer:** yes

### 2.4 Devices
Phone-first, or will you also log on desktop?
*[Default: phone-first, usable on desktop]*

**Answer:** phone first and usable on desktop

---

## 3. Food data and scanning

### 3.1 Food database
Where should food data come from? Free options: Open Food Facts (good barcode coverage, no key) and USDA FoodData Central (accurate whole foods, free API key).
*[Default: Open Food Facts for barcodes, USDA for search, results cached locally so they work offline]*

**Answer:** Open Food Facts for barcodes, USDA for search, results cached locally so they work offline

### 3.2 Phone and scanning
What phone do you use? Native browser barcode scanning only works in Chrome on Android; iPhone/Safari needs a JavaScript scanning library.
*[Default: use a library so scanning works on both]*

**Answer:** have phone implementation focused for iphone/safari

### 3.3 Missing or wrong products
If a scanned product isn't found or its data looks wrong, can you edit it and save your own version?
*[Default: yes, your edits take priority]*

**Answer:** yes, your edits take priority

### 3.4 Label OCR
Scan nutrition labels with the camera (OCR)? This is much harder.
*[Default: no, type labels in manually]*

**Answer:** no type labels manually

---

## 4. Nutrients

### 4.1 Tracked nutrients
Which nutrients should be tracked? Do you want full micronutrients (vitamins and minerals, Cronometer's strength), now or later?
*[Default: calories, protein, carbs, fat, fiber, sugar, saturated fat, sodium]*

**Answer:** track calories, protein, carbs, fat as primary and easily visible, and also track fiber, sugar, saturated fat, sodium

### 4.2 Total vs net carbs
Show total carbs or net carbs (carbs minus fiber)?
*[Default: total, with an option for net]*

**Answer:** track net carbs

---

## 5. Units and amounts

### 5.1 Food amounts
How do you usually measure food: grams on a scale, "1 serving", or cups/tbsp/oz?
*[Default: grams plus the food's own serving sizes, with custom servings such as "1 scoop" allowed]*

**Answer:** grams plus the food's own serving sizes, with custom servings such as "1 scoop" allowed

### 5.2 Body weight units
Metric or imperial for body weight?
*[Default: lb/kg setting, same as trakr]*

**Answer:** track bodyweight in pounds with with kg alt text

---

## 6. Meals vs recipes

### 6.1 Saved meals and recipes
Do you want saved meals (a group of foods added in one tap, e.g. "usual breakfast: oats, whey, banana"), recipes (a batch with servings, e.g. "chili, makes 6"), or both?
*[Default: both, as "Saved meals" and "Recipes"]*

**Answer:** I want saved meals and recipes

### 6.2 Adjusting a meal when logging
When logging a saved meal, can you change the amount of each item for that day without changing the saved meal?
*[Default: yes]*

**Answer:** yes

### 6.3 Editing history
If you later edit a food or meal, should past logged days change too? (trakr snapshots so history stays fixed.)
*[Default: no, past days keep their snapshot]*

**Answer:** no, past days keep their snapshot

---

## 7. Daily log and categories

### 7.1 Categories
Fixed list (Breakfast, Lunch, Meal 3, Dinner, Snacks), or editable (rename, reorder, add, remove) in Settings?
*[Default: editable, with your list as the default]*

**Answer:** editable, with your list as the default

### 7.2 Default category
When adding a food, pick the category by time of day?
*[Default: yes, and you can change it]*

**Answer:** yes, and you can change it

### 7.3 Speed-ups
Which do you want: recent foods, favourites, "copy yesterday's breakfast", quick add (calories/macros only)?
*[Default: all four]*

**Answer:** all four

### 7.4 Future days
Log future days (meal planning/prep) or only today and past days?
*[Default: today and past only, like trakr]*

**Answer:** log today only

### 7.5 Water and notes
Track water, or add notes per day?
*[Default: neither for now]*

**Answer:** neither, don't track water for now.

---

## 8. Goals and the daily summary

### 8.1 Setting goals
Enter goals directly (e.g. 2,400 kcal, 180 g protein), or have the app calculate them from age, height, weight and activity? (trakr's rule is "data, not advice".)
*[Default: enter directly]*

**Answer:** enter directly

### 8.2 Macro goal format
Macro goals in grams, percentages of calories, or either?
*[Default: grams, with percentages shown as well]*

**Answer:** grams, with percentages shown as well

### 8.3 Daily summary display
Progress bars, Cronometer-style rings, or plain numbers ("1,620 / 2,400")? Show what's left or what's eaten?
*[Default: a calorie bar plus a bar per macro, each showing eaten / goal and what's left]*

**Answer:**  a calorie bar plus a bar per macro, each showing eaten / goal and what's left

### 8.4 Goal history
Keep a history of goals so old days compare against the goal you had then?
*[Default: yes]*

**Answer:** yes

---

## 9. Weigh-ins

### 9.1 What to record
How often will you weigh in? Also body fat % or measurements like waist?
*[Default: weight only, with an optional body fat field]*

**Answer:** weight only, with an optional body fat field

### 9.2 Weight chart
Raw points only, or a smoothed trend line like a 7-day average?
*[Default: both]*

**Answer:** raw points only

---

## 10. History and trends

### 10.1 Trend views
Beyond the daily view: weekly averages, a calendar of days on or off goal, nutrient charts over time?
*[Default: weekly averages plus a calories/protein chart; the rest later]*

**Answer:**  weekly averages plus a calories/protein chart; the rest later

### 10.2 Export
CSV export as well as JSON backup?
*[Default: JSON backup only at first]*

**Answer:** JSON backup only at first

---

## 11. Spec and handoff to other agents

### 11.1 Spec format
Match trakr's format (SPEC.md, design-system doc, README) plus a phased build plan for agents (data layer → daily log → food search/scan → meals → goals → weigh-ins → trends)?
*[Default: yes]*

**Answer:** yes

### 11.2 App name
Does the app have a name?
*[Default: I can suggest some]*

**Answer:** myeats

---

## 12. Anything else

Features, constraints or things you definitely don't want:

**Answer:** I would also like to make sure the app is fast and responsive so finding and adding foods is quick.