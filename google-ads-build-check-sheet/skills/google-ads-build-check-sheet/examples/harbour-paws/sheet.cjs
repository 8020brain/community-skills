/**
 * Example build check sheet. Harbour Paws is a made-up mobile dog groomer.
 *
 * Copy this file to clients/<key>/build-sheet/sheet.cjs, replace everything, then run
 *   node .claude/skills/google-ads-build-check-sheet/scripts/build-sheet.mjs clients/<key>/build-sheet
 *
 * Exporting a function gives you the helpers in `b` (see scripts/blocks.cjs) for the
 * free-written sections. Every section is optional except the ad groups: leave a key
 * out and its section disappears. Sections are numbered automatically.
 *
 * Text in `intro`, `body`, `html` and notes is HTML, so <strong> works. Ad copy is
 * plain text and is escaped for you.
 */

module.exports = (b) => ({
  // ------------------------------------------------------------ the page itself
  meta: {
    client: 'Harbour Paws',
    domain: 'harbourpaws.com.au', // shown in the ad previews
    date: '23 September 2026',
    preparedBy: 'Your Name',
    status: 'draft', // 'draft' = awaiting approval, 'built' = in the account and paused
    logos: {
      client: '', // e.g. 'logo.png', relative to this folder, or a URL. Missing = the name as text
      agency: '', // your own logo. Blank = your name as text
    },
    // lede, eyebrow, heading, footer and title can all be overridden here.
  },

  // theme.brand alone is usually enough. theme.light / theme.dark override any colour,
  // theme.fonts swaps the fonts ({ head, body, mono, googleFonts }).
  theme: { brand: '#0E7C86' },

  // House rules for the copy. These are the defaults, shown so you can see them.
  rules: {
    spelling: 'au', // 'au' (NZ and UK too), 'us' or 'off'
    ampersand: true,
    titleCase: true,
    descMin: 78,
    descriptionsPerAd: 4,
    banned: [
      // For health clients, e.g. { pattern: /\bbest\b/i, why: 'AHPRA, no claims of being the best' }
      { pattern: /\bcheapest\b/i, why: 'we do not compete on price' },
    ],
  },

  // Tiles under the heading.
  summary: [
    { label: 'Ad groups', value: '3 groups', sub: 'One search theme each' },
    { label: 'Daily budget', value: '$30 / day', sub: 'About $912 a month' },
    { label: 'Ads status', value: 'Not live', sub: 'Waiting on your approval', wait: true },
  ],

  // Free-written sections before the campaign sections. Use for findings, tracking, etc.
  before: [
    {
      title: 'What we found',
      html: [
        b.note('Your account has run before, but it was counting page visits as enquiries, so the results it reported were higher than what actually came through.'),
        b.call('What this means for you', 'We are starting the measurement fresh, so every number from here on is a real enquiry.'),
      ].join('\n'),
    },
    {
      title: 'What we count as an enquiry',
      html: [
        b.note('Two things a visitor can do that we treat as a genuine result. Each is counted once per person.'),
        b.table(
          ['What the visitor does', 'Counts as'],
          [
            ['Submits your booking form', b.pill('Primary')],
            ['Taps your phone number', b.pill('Primary')],
          ],
        ),
      ].join('\n'),
    },
  ],

  // "Where your ads will show"
  targeting: {
    intro: 'The suburbs your van covers, and nowhere else. We target people who are in these areas, not people elsewhere reading about them.',
    locations: [
      ['Inner West', 'Balmain, Leichhardt, Newtown, Marrickville'],
      ['Eastern Suburbs', 'Bondi, Coogee, Randwick, Paddington'],
      ['Lower North Shore', 'Mosman, Neutral Bay, Cremorne'],
    ],
    stats: [
      { label: 'Daily budget', value: '$30 / day', sub: 'About $912 a month' },
      { label: 'When ads run', value: '6am to 9pm', sub: 'Seven days a week' },
    ],
    negatives: {
      lists: [
        { name: 'Do it yourself', examples: 'People after clippers, shampoo or how to groom at home', count: 42 },
        { name: 'Jobs & training', examples: 'Grooming courses, apprenticeships, salaries', count: 31 },
        { name: 'Other cities', examples: 'Melbourne, Brisbane, the Central Coast', count: 58 },
      ],
    },
    notes: [{ title: 'Why the ads run early', body: 'Most bookings are made before work, so the ads are on from 6am.' }],
  },

  // "What every ad says about you"
  positioning: {
    intro: 'Three things every ad leans on, because they are what set you apart.',
    pillars: [
      { h: 'We come to you', d: 'A fully fitted van parked outside your home. No car trip, no kennel.' },
      { h: 'One dog at a time', d: 'No cages and no waiting around other dogs.' },
      { h: 'Same groomer each visit', d: 'Your dog gets to know one person.' },
    ],
    notes: [{ title: 'Deliberately absent', body: 'No prices in the ads. They vary by breed and coat, so we let the booking form do that.', warn: true }],
  },

  // ------------------------------------------------------------ the ad copy
  // Same shape as a copy-data.cjs for the google-ads-account-setup skill, so you can
  // point this at an existing file with `copy: require('../copy-data.cjs')`.
  copy: {
    SHARED_USP: ['Mobile Dog Grooming', 'We Come To Your Door', 'One Dog At A Time'],
    SHARED_CTA: ['Book Your Groom Today', 'Check Our Next Available'],
    SHARED_DESC: [
      'A Fully Fitted Grooming Van Parked Outside Your Home. No Car Trips, No Kennels At All.',
      'Calm, One On One Grooming With The Same Groomer Every Visit. Book Your Next Groom Now.',
    ],
    AD_GROUPS: [
      {
        name: 'Mobile Dog Grooming',
        intent: 'The owner already wants someone to come to them.',
        keywords: ['mobile dog grooming', 'mobile dog groomer'],
        path: ['Mobile', 'Grooming'],
        headlines: ['Mobile Dog Grooming Sydney', 'Mobile Dog Groomer Near You', 'Grooming Van At Your Door'],
        descriptions: [
          'Mobile Dog Grooming Across Sydney. Wash, Cut, Nails & Ears Done Right Outside Your Home.',
          'Skip The Salon. Our Grooming Van Comes To You On A Day & Time That Suits Your Household.',
        ],
        note: 'The easiest search to win. They want exactly what you offer.',
      },
      {
        name: 'Dog Grooming Near Me',
        intent: 'The broadest search. Many will not know mobile grooming exists.',
        keywords: ['dog grooming near me', 'dog groomer near me'],
        path: ['Dog', 'Grooming'],
        headlines: ['Dog Grooming Near You', 'Local Dog Groomer', 'Grooming Without The Drive'],
        descriptions: [
          'Local Dog Grooming That Comes To You. Serving The Inner West, Eastern Suburbs & North.',
          'Wash, Cut, Nail Trim & Ear Clean In Our Van, Parked Right Outside Your Home. Book Now.',
        ],
      },
      {
        name: 'Anxious Dog Grooming',
        intent: 'An owner whose dog struggles at a busy salon.',
        keywords: ['grooming for anxious dogs'],
        path: ['Anxious', 'Dogs'],
        headlines: ['Grooming For Anxious Dogs', 'Calm, Quiet Grooming', 'No Cages, No Other Dogs'],
        descriptions: [
          'Grooming For Nervous Dogs In A Quiet Van, With No Cages & No Other Dogs Around Them.',
          'Patient, Gentle Groomers Who Take Their Time So Your Dog Stays Calm The Whole Session.',
        ],
        note: 'Written for the owner who has had a bad salon experience.',
      },
    ],

    // action: keep | update | new | remove. `have` is what is in the account now (leave
    // it out for a brand new account and the "what is there now" wording disappears).
    SITELINKS: [
      { text: 'Book A Groom', d1: 'Pick A Day & Time Online', d2: 'We Confirm Within The Hour', action: 'new' },
      { text: 'Areas We Cover', d1: 'Inner West & Eastern Suburbs', d2: 'Lower North Shore Too', action: 'new' },
      { text: 'Our Grooming Van', d1: 'Warm Water & Quiet Dryers', d2: 'Fully Fitted & Air Conditioned', action: 'new' },
      { text: 'Meet The Groomers', d1: 'Qualified & Fully Insured', d2: 'The Same Groomer Every Time', action: 'new' },
    ],
    SITELINKS_REMOVE: [],
    CALLOUTS: [
      { text: 'Fully Insured', action: 'new' },
      { text: 'All Breeds Welcome', action: 'new' },
      { text: 'Open Seven Days', action: 'new' },
      { text: 'Natural Shampoos', action: 'new' },
    ],
    SNIPPETS: {
      header: 'Services',
      values: ['Full Groom', 'Wash & Dry', 'Nail Trim', 'Puppy Intro Groom'],
      action: 'new',
    },
    CALL_ASSET: { proposed: '0400 000 000', action: 'new' },
  },

  assetNotes: [],

  // "What is left before we go live". status: done | waiting | todo
  checklist: {
    items: [
      { step: 'Tracking tested end to end', who: 'Us', status: 'done' },
      { step: 'Ad wording approved', who: 'Harbour Paws', status: 'waiting' },
      { step: 'Campaign built in your account, paused', who: 'Us', status: 'todo' },
      { step: 'Switch on', who: 'Both', status: 'todo' },
    ],
  },

  // "What we need from you"
  asks: [
    { title: 'Read the ad wording and tell us what does not sound like you.', body: 'Change anything you want changed.' },
    { title: 'Confirm the suburbs.', body: 'If the van goes further than the areas above, tell us before we go live.' },
  ],

  // Free-written sections after the campaign sections, before the checklist.
  after: [],
});
