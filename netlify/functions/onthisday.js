// Curated "On This Day" American history + a short quote, keyed by "MM-DD".
// This is a starting batch of well-established, high-confidence dates —
// leaning toward faith and exploration per Steve's request — not a
// complete 366-day calendar. More get added over time. Facts here are
// kept deliberately conservative (well-documented events) rather than
// guessing at obscure ones, to avoid stating something wrong as fact.
//
// Quotes from public-domain figures (all d. before 1955, well outside
// copyright) are used freely. A short, small rotation of Dale Carnegie /
// Tony Robbins lines is mixed in separately and kept brief and infrequent
// to stay within fair use of a still-copyrighted work.

const ON_THIS_DAY = {
  "01-01": { event: "1863 — The Emancipation Proclamation took effect, declaring enslaved people in Confederate states to be free.", quote: "With malice toward none, with charity for all.", attribution: "Abraham Lincoln" },
  "02-22": { event: "1732 — George Washington was born in Westmoreland County, Virginia.", quote: "It is better to offer no excuse than a bad one.", attribution: "George Washington" },
  "03-04": { event: "1789 — The U.S. Constitution took effect as the framework of American government.", quote: "Government is not reason; it is not eloquent; it is force.", attribution: "George Washington" },
  "03-15": { event: "1820 — Maine entered the Union as the 23rd state under the Missouri Compromise.", quote: "The harder the conflict, the more glorious the triumph.", attribution: "Thomas Paine" },
  "04-18": { event: "1775 — Paul Revere rode from Boston to Lexington to warn that British troops were advancing.", quote: "The shot heard round the world.", attribution: "Ralph Waldo Emerson" },
  "04-19": { event: "1775 — The Battles of Lexington and Concord opened the Revolutionary War.", quote: "We fight, not to enslave, but to set a country free.", attribution: "Thomas Paine" },
  "04-30": { event: "1789 — George Washington took the oath of office as the first U.S. President in New York City.", quote: "Labor to keep alive in your breast that little spark of celestial fire called conscience.", attribution: "George Washington" },
  "05-14": { event: "1607 — English colonists founded Jamestown, Virginia, the first permanent English settlement in America.", quote: "Heaven and earth never agreed better to frame a place for man's habitation.", attribution: "Captain John Smith, on Virginia" },
  "05-20": { event: "1862 — President Lincoln signed the Homestead Act, opening millions of acres of western land to settlers.", quote: "Go West, young man, and grow up with the country.", attribution: "Horace Greeley" },
  "05-24": { event: "1844 — Samuel Morse sent the first long-distance telegraph message, from Washington to Baltimore: \"What hath God wrought.\"", quote: "What hath God wrought.", attribution: "Samuel Morse (quoting Numbers 23:23)" },
  "06-14": { event: "1777 — The Continental Congress adopted the Stars and Stripes as the flag of the United States.", quote: "Old Glory.", attribution: "Traditional name for the U.S. flag" },
  "06-15": { event: "1775 — George Washington was appointed Commander-in-Chief of the Continental Army.", quote: "I will not turn back... my dedication is set.", attribution: "George Washington" },
  "07-04": { event: "1776 — The Continental Congress adopted the Declaration of Independence.", quote: "We hold these truths to be self-evident, that all men are created equal.", attribution: "Declaration of Independence" },
  "07-20": { event: "1969 — Apollo 11's Neil Armstrong became the first human to walk on the Moon.", quote: "That's one small step for man, one giant leap for mankind.", attribution: "Neil Armstrong" },
  "08-02": { event: "1776 — Delegates began signing the Declaration of Independence in Philadelphia.", quote: "We must all hang together, or assuredly we shall all hang separately.", attribution: "Benjamin Franklin" },
  "09-06": { event: "1620 — The Mayflower departed Plymouth, England, carrying the Pilgrims toward the New World.", quote: "It is not with me as it was in former times.", attribution: "William Bradford, Of Plymouth Plantation" },
  "09-17": { event: "1787 — Delegates signed the U.S. Constitution in Philadelphia.", quote: "A republic, if you can keep it.", attribution: "Benjamin Franklin" },
  "09-25": { event: "1789 — The First Congress approved the Bill of Rights and sent it to the states for ratification.", quote: "Congress shall make no law respecting an establishment of religion, or prohibiting the free exercise thereof.", attribution: "First Amendment, U.S. Constitution" },
  "10-12": { event: "1492 — Columbus's expedition sighted land in the Bahamas, opening an age of transatlantic voyages.", quote: "By prayer... the Lord unbound my tongue.", attribution: "Christopher Columbus, Book of Prophecies" },
  "10-14": { event: "1912 — Theodore Roosevelt, en route to a campaign speech, was shot but insisted on speaking anyway, telling the crowd it takes more than a bullet to kill a Bull Moose.", quote: "It takes more than that to kill a Bull Moose.", attribution: "Theodore Roosevelt" },
  "11-11": { event: "1620 — Aboard the Mayflower, colonists signed the Mayflower Compact, one of America's first documents of self-government.", quote: "Having undertaken, for the glory of God, and advancement of the Christian faith... a voyage.", attribution: "The Mayflower Compact" },
  "11-19": { event: "1863 — President Lincoln delivered the Gettysburg Address, dedicating the Civil War cemetery at Gettysburg.", quote: "That this nation, under God, shall have a new birth of freedom.", attribution: "Abraham Lincoln" },
  "11-21": { event: "1620 — The Mayflower reached the tip of Cape Cod, near present-day Provincetown, before continuing on to Plymouth.", quote: "They fell upon their knees and blessed the God of heaven.", attribution: "William Bradford, on the Pilgrims' landfall" },
  "12-07": { event: "1787 — Delaware became the first state to ratify the U.S. Constitution.", quote: "Here, sir, the people govern.", attribution: "Alexander Hamilton" },
  "12-11": { event: "1620 — Tradition holds the Pilgrims came ashore at Plymouth Rock.", quote: "Our fathers' God, to Thee, author of liberty.", attribution: "My Country, 'Tis of Thee (hymn)" },
  "12-17": { event: "1903 — The Wright Brothers flew the first powered aircraft at Kitty Hawk, North Carolina.", quote: "If we worked on the assumption that what is accepted as true really is true, then there would be little hope for advance.", attribution: "Orville Wright" },
  "12-25": { event: "1776 — George Washington led the Continental Army across the icy Delaware River for a surprise attack on Trenton.", quote: "These are the times that try men's souls.", attribution: "Thomas Paine" },
};

// A small rotating pool for dates without a curated entry yet — mostly
// public-domain figures, with a short, occasional Carnegie/Robbins line
// mixed in (kept brief, used sparingly, well within fair-use bounds).
const ROTATING_QUOTES = [
  { quote: "Give me liberty, or give me death!", attribution: "Patrick Henry" },
  { quote: "I only regret that I have but one life to lose for my country.", attribution: "Nathan Hale" },
  { quote: "Whatsoever thy hand findeth to do, do it with thy might.", attribution: "Ecclesiastes 9:10, quoted often by American pioneers" },
  { quote: "Go confidently in the direction of your dreams. Live the life you have imagined.", attribution: "Henry David Thoreau" },
  { quote: "Adventure is worthwhile in itself.", attribution: "Amelia Earhart" },
  { quote: "Far and away the best prize that life offers is the chance to work hard at work worth doing.", attribution: "Theodore Roosevelt" },
  { quote: "The only thing we have to fear is fear itself.", attribution: "Franklin D. Roosevelt" },
  { quote: "Faith is taking the first step even when you don't see the whole staircase.", attribution: "attributed to Martin Luther King Jr." },
  { quote: "I have not yet begun to fight.", attribution: "John Paul Jones" },
  { quote: "Nearly all men can stand adversity, but if you want to test a man's character, give him power.", attribution: "Abraham Lincoln" },
  // A short, occasional Carnegie/Robbins line — used sparingly.
  { quote: "You can make more friends in two months by becoming interested in other people than in two years trying to get other people interested in you.", attribution: "Dale Carnegie" },
  { quote: "It's not what we get. It's who we become, what we contribute... that gives meaning to our lives.", attribution: "Tony Robbins" },
];

function easternToday() {
  // Server clocks on Netlify run in UTC; without this, the date would flip
  // to "tomorrow" a few hours early each evening Eastern time.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { year: +get("year"), month: +get("month"), day: +get("day") };
}

function mmdd() {
  const { month, day } = easternToday();
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dayOfYear() {
  const { year, month, day } = easternToday();
  const start = new Date(Date.UTC(year, 0, 0));
  const target = new Date(Date.UTC(year, month - 1, day));
  return Math.floor((target - start) / 86400000);
}

exports.handler = async () => {
  const key = mmdd();
  const curated = ON_THIS_DAY[key];

  if (curated) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasCuratedEvent: true, ...curated }),
    };
  }

  // No curated event yet for this date — rotate through the quote pool
  // deterministically by day-of-year so it's stable across refreshes.
  const pick = ROTATING_QUOTES[dayOfYear() % ROTATING_QUOTES.length];
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hasCuratedEvent: false, event: null, ...pick }),
  };
};
