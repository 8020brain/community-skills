CREATE TABLE (
  "Name" TITLE,
  "Ad Image" FILES,
  "Ad URL" URL,
  "Advertiser" RICH_TEXT,
  "Ad Format" SELECT('Single image':blue, 'Carousel':purple, 'Video':red, 'Document':orange, 'Text / Spotlight':gray, 'Message / Conversation':green, 'Event':yellow, 'Thought leader':pink),
  "Creative Style" MULTI_SELECT('Bold headline':blue, 'Stat / data':green, 'Testimonial / quote':purple, 'Product screenshot':gray, 'Person / face':pink, 'Illustration':orange, 'Photography':brown, 'Meme / humour':yellow, 'Before / after':red, 'Comparison':blue, 'Minimal / text-only':gray, 'UGC / native look':green, 'Branded template':purple, 'Offer / discount':red),
  "Hook" MULTI_SELECT('Question':blue, 'Pain point':red, 'Bold claim':orange, 'Social proof':green, 'Curiosity':purple, 'Urgency':yellow, 'Free resource':pink, 'Contrarian':gray),
  "Objective" SELECT('Awareness':gray, 'Traffic':blue, 'Engagement':purple, 'Lead gen':green, 'Conversions':orange, 'Event registration':yellow, 'Hiring':brown),
  "CTA" SELECT('Learn more':blue, 'Sign up':green, 'Register':purple, 'Download':orange, 'Request demo':red, 'Apply':brown, 'Get quote':yellow, 'Subscribe':pink, 'Visit website':gray),
  "Industry" MULTI_SELECT('SaaS / Tech':blue, 'Finance':green, 'Healthcare':red, 'Education':yellow, 'Agency / Marketing':purple, 'Recruitment':orange, 'Professional services':gray, 'E-commerce / Retail':pink, 'Travel / Hospitality':brown),
  "Headline" RICH_TEXT,
  "Intro Text" RICH_TEXT,
  "Why It Works" RICH_TEXT,
  "Rating" SELECT('⭐⭐⭐ Swipe it':yellow, '⭐⭐ Good':blue, '⭐ Reference':gray),
  "Date Added" CREATED_TIME
)
