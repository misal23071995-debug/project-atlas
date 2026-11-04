// Made-up people and conversations for demo data. All names and emails are fictional.

export const DEMO_TAG = "Demo data";
// Every demo customer's email ends with this, so demo data can be found and removed
export const DEMO_EMAIL_DOMAIN = "demo-customers.example";

export interface DemoAgent {
  name: string;
  // Share of tickets they take
  weight: number;
  // Multiplies reply and resolution times; under 1 is faster
  speed: number;
  // Added to every QC criterion score (1-5 scale), plus per-criterion adjustments
  quality: number;
  strengths: Record<string, number>;
}

export const DEMO_AGENTS: DemoAgent[] = [
  { name: "Priya Sharma", weight: 22, speed: 0.7, quality: 0.5, strengths: { empathy: 0.3 } },
  { name: "Arjun Mehta", weight: 20, speed: 1, quality: 0, strengths: {} },
  { name: "Meera Iyer", weight: 17, speed: 1.25, quality: 0.4, strengths: { accuracy: 0.3 } },
  { name: "Rahul Das", weight: 18, speed: 0.75, quality: -0.2, strengths: { empathy: -1.1, greeting: -0.6 } },
  { name: "Sara Thomas", weight: 11, speed: 1.5, quality: -0.4, strengths: { accuracy: -0.7, ownership: -0.3 } },
  { name: "Kabir Singh", weight: 12, speed: 1.05, quality: 0.1, strengths: {} },
];

export const DEMO_REVIEWER = "Neha Kapoor (QA)";

export const FIRST_NAMES = [
  "Aanya", "Rohan", "Ishita", "Vikram", "Diya", "Aditya", "Kavya", "Nikhil", "Sneha", "Karan",
  "Pooja", "Siddharth", "Ananya", "Varun", "Riya", "Manish", "Tara", "Harsh", "Neel", "Zara",
  "Emma", "Liam", "Olivia", "Noah", "Sofia", "Lucas", "Mia", "Ethan", "Chloe", "Omar",
];

export const LAST_NAMES = [
  "Kapoor", "Rao", "Nair", "Gupta", "Menon", "Joshi", "Patel", "Reddy", "Bose", "Malhotra",
  "Chopra", "Pillai", "Saxena", "Verma", "Khan", "Fernandes", "Smith", "Brown", "Wilson", "Garcia",
];

export const LOCATIONS = [
  "Mumbai, IN", "Bengaluru, IN", "Delhi, IN", "Pune, IN", "Hyderabad, IN", "Chennai, IN", "Kolkata, IN",
  "Ahmedabad, IN", "Dubai, AE", "London, UK", "Singapore, SG", "New York, US",
];

export const DEVICES = ["iPhone 15", "iPhone 13", "Pixel 8", "Galaxy S24", "OnePlus 12", "iPhone 16 Pro", "Redmi Note 13"];

export interface DemoTopic {
  category: string;
  // Relative share of contacts
  weight: number;
  subjects: string[];
  questions: string[];
  replies: string[];
  closings: string[];
}

export const DEMO_TOPICS: DemoTopic[] = [
  {
    category: "Sync & App",
    weight: 24,
    subjects: ["Ring not syncing", "Sleep data missing from last night", "App stuck on 'Connecting'", "Sync stopped after update"],
    questions: [
      "My ring hasn't synced since yesterday. I've restarted the app twice and it still says connecting.",
      "Last night's sleep isn't showing in the app at all. The ring was on my finger the whole night.",
      "After the latest firmware update the app can't find my ring any more. Bluetooth is on.",
    ],
    replies: [
      "Sorry about the sync trouble. Please put the ring on its charger for 10 seconds, then take it off and pull down on the home screen to sync. Your data is stored on the ring for up to a week, so nothing is lost.",
      "Thanks for the details. Could you check that the Atlas app has Bluetooth and background refresh allowed in your phone settings? If it still won't connect, go to Settings > Ring > Forget ring and pair again.",
    ],
    closings: ["That worked, thank you!", "Synced now, all my sleep data is back.", "Paired again and it's fine now."],
  },
  {
    category: "Battery & Charging",
    weight: 15,
    subjects: ["Battery draining fast", "Charger light blinking amber", "Ring not charging"],
    questions: [
      "My battery used to last 6 days and now it's barely 2. Is something wrong with the ring?",
      "The charger light keeps blinking amber and the ring isn't charging.",
      "I put the ring on the dock overnight and it's still at 20% this morning.",
    ],
    replies: [
      "That's shorter than it should be. Continuous heart-rate mode uses a lot of power, so please check Settings > Health and turn it off if it's on. If a full charge still lasts under 2 days, I'll arrange a battery check under warranty.",
      "An amber light usually means the contacts aren't touching. Please wipe the charging contacts with a dry cloth, seat the ring with the sensor bumps facing in and try a different USB port.",
    ],
    closings: ["Turned it off, battery looks much better.", "Cleaned the contacts and it's charging now. Thanks!", "OK, please go ahead with the warranty check."],
  },
  {
    category: "Orders & Shipping",
    weight: 14,
    subjects: ["Where is my order?", "Change delivery address", "Order shows delivered but not received"],
    questions: [
      "I ordered a week ago and the tracking hasn't moved for three days.",
      "Can I change my delivery address? I'm moving next week.",
      "Tracking says delivered but there's nothing at my door.",
    ],
    replies: [
      "I've checked with the courier and your parcel is at the local hub. It's due out for delivery within 2 business days, and you'll get an SMS when it's on its way.",
      "I've raised a trace with the courier for you. If it isn't found within 48 hours we'll send a replacement at no cost.",
    ],
    closings: ["Got it today, thanks!", "Great, thanks for checking.", "Found it with my neighbour. Sorry for the trouble!"],
  },
  {
    category: "Sizing",
    weight: 9,
    subjects: ["Ring is too tight", "Exchange for a different size", "Which size should I order?"],
    questions: [
      "The ring feels too tight on my index finger. Can I swap it for a bigger size?",
      "The sizing kit said 9 but the ring is loose. Can I exchange it?",
    ],
    replies: [
      "Of course. Size exchanges are free within 30 days of delivery. I've emailed you a prepaid return label, and the new size ships as soon as the courier collects the old one.",
    ],
    closings: ["Thanks, label received.", "Perfect, thank you."],
  },
  {
    category: "Returns & Refunds",
    weight: 10,
    subjects: ["Refund not received", "I'd like to return my ring", "Return status"],
    questions: [
      "I returned my ring two weeks ago and haven't got my refund yet.",
      "The ring isn't for me. How do I return it?",
    ],
    replies: [
      "Your return arrived on our side and the refund was issued today. It usually takes 5 to 10 business days to show in your account, depending on your bank.",
      "Sorry it wasn't the right fit. You can return it within 30 days of delivery. I've emailed you a prepaid label, and the refund goes back to your original payment method once it arrives.",
    ],
    closings: ["Refund arrived, thanks.", "Thanks for the quick help."],
  },
  {
    category: "Warranty",
    weight: 7,
    subjects: ["Crack on the ring", "Ring stopped working", "Warranty claim"],
    questions: [
      "There's a small crack on the inside of the ring. It's only four months old.",
      "My ring won't turn on at all, even on the charger.",
    ],
    replies: [
      "I'm sorry to hear that. Could you send a photo of the crack and your order number? Once I have them I'll start the warranty claim and arrange a replacement.",
      "Thanks for trying the charger. This looks like a hardware fault, so I've approved a warranty replacement. You'll get a shipping email within 2 business days.",
    ],
    closings: ["Photo attached. Thanks.", "Replacement arrived, works perfectly."],
  },
  {
    category: "Plans & Subscriptions",
    weight: 11,
    subjects: ["Cancel Atlas+ membership", "Charged twice for Atlas+", "'Already subscribed' error"],
    questions: [
      "How do I cancel my Atlas+ membership? I can't find the option in the app.",
      "I've been charged twice this month for Atlas+.",
      "The app says I'm already subscribed but my Atlas+ features are locked.",
    ],
    replies: [
      "On iPhone, memberships are managed by Apple: open Settings, tap your name, then Subscriptions > Atlas+ > Cancel. You keep the features until the end of the billing period.",
      "I can see the duplicate charge and I've refunded the second one. It'll be back on your card in 5 to 7 business days.",
      "Please go to Settings > Account > Restore purchases in the app. That links your existing membership to this account.",
    ],
    closings: ["Done, thanks!", "Restore worked.", "Thanks for sorting the refund."],
  },
  {
    category: "Account & Privacy",
    weight: 6,
    subjects: ["Change account email", "Delete my data", "Can't log in"],
    questions: [
      "I want to change the email on my account.",
      "Please delete my account and all my health data.",
      "I'm not getting the login code email.",
    ],
    replies: [
      "You can change it in Settings > Account > Email. We'll send a confirmation link to the new address.",
      "I've started the deletion. Your account and all health data will be permanently removed within 7 days, and you'll get a confirmation email when it's done.",
    ],
    closings: ["Changed it, thank you.", "Thanks for confirming."],
  },
  {
    category: "Getting Started",
    weight: 4,
    subjects: ["How do I set up my ring?", "Which finger should I wear it on?"],
    questions: ["Just got my ring. How do I pair it with the app?", "Which finger gives the most accurate readings?"],
    replies: [
      "Welcome! Charge the ring for 30 minutes, open the Atlas app, tap 'Add ring' and hold it next to your phone. Your first scores appear after two nights of wear.",
    ],
    closings: ["All set up, thanks!"],
  },
];

export const CHANNELS = [
  { channel: "AI Chatbot", weight: 38 },
  { channel: "Email", weight: 28 },
  { channel: "Chat", weight: 16 },
  { channel: "Phone", weight: 11 },
  { channel: "Social", weight: 7 },
];

export const QC_FEEDBACK: Record<"high" | "mid" | "low", string[]> = {
  high: ["Great ownership and a clear fix. Nice work.", "Warm tone and accurate steps. A good example for the team."],
  mid: ["Solid answer. Add a short apology when the customer is frustrated.", "Correct fix; the reply could be shorter and easier to scan."],
  low: [
    "The customer was upset and the reply didn't acknowledge it. Open with empathy before the steps.",
    "Policy details were wrong here. Please check the knowledge base article before replying.",
  ],
};
