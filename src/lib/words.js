// Numbers in words, for the grown-up check ("seven hundred twelve").
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 1–999 in words, without "and": 712 → "seven hundred twelve". */
export function numberWords(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const restWords = rest < 20 ? ONES[rest] : TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : "");
  return [hundreds ? `${ONES[hundreds]} hundred` : "", restWords].filter(Boolean).join(" ");
}
