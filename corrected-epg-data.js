// ✅ CORRECTED EPG DATA - Use this instead of your old data
// This data has current timestamps so programs will actually display

function generateCurrentEPGData() {
  const now = new Date();
  
  // Set to current hour for better alignment
  now.setMinutes(0, 0, 0);
  const currentHour = now.getTime();

  return {
    timeline: [
      {
        programTitle: "Channel 1",
        channelLogo: "https://example.com/logo-ch1.png",
        channelId: "ch1",
        data: [
          {
            id: 1,
            title: "Morning News",
            description: "Top stories to start your day.",
            since: new Date(currentHour - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            till: new Date(currentHour).toISOString(),                        // now
            category: "News",
            rating: "General"
          },
          {
            id: 2,
            title: "Sports Roundup",
            description: "Latest highlights from the world of sports.",
            since: new Date(currentHour).toISOString(),                       // now
            till: new Date(currentHour + 1 * 60 * 60 * 1000).toISOString(),  // 1 hour from now
            category: "Sports",
            rating: "General"
          },
          {
            id: 3,
            title: "Cooking Show",
            description: "Delicious recipes and cooking tips.",
            since: new Date(currentHour + 1 * 60 * 60 * 1000).toISOString(),  // 1 hour from now
            till: new Date(currentHour + 2 * 60 * 60 * 1000).toISOString(),  // 2 hours from now
            category: "Lifestyle",
            rating: "PG"
          }
        ]
      },
      {
        programTitle: "Channel 2",
        channelLogo: "https://example.com/logo-ch2.png",
        channelId: "ch2",
        data: [
          {
            id: 4,
            title: "Cartoon Hour",
            description: "Fun animated shows for kids.",
            since: new Date(currentHour - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
            till: new Date(currentHour).toISOString(),                          // now
            category: "Kids",
            rating: "General"
          },
          {
            id: 5,
            title: "Adventure Movie",
            description: "An action-packed adventure film.",
            since: new Date(currentHour).toISOString(),                         // now (will show as LIVE)
            till: new Date(currentHour + 2 * 60 * 60 * 1000).toISOString(),    // 2 hours from now
            category: "Movies",
            rating: "PG-13"
          }
        ]
      },
      {
        programTitle: "Channel 3",
        channelLogo: "https://example.com/logo-ch3.png",
        channelId: "ch3",
        data: [
          {
            id: 6,
            title: "Tech Today",
            description: "Latest news from the tech world.",
            since: new Date(currentHour - 1 * 60 * 60 * 1000).toISOString(),   // 1 hour ago
            till: new Date(currentHour).toISOString(),                          // now
            category: "Technology",
            rating: "General"
          },
          {
            id: 7,
            title: "Documentary: Earth",
            description: "Exploring natural wonders across the globe.",
            since: new Date(currentHour).toISOString(),                         // now (will show as LIVE)
            till: new Date(currentHour + 1.5 * 60 * 60 * 1000).toISOString(),  // 1.5 hours from now
            category: "Documentary",
            rating: "General"
          },
          {
            id: 8,
            title: "Late Night Talk",
            description: "Interviews with celebrities and live music.",
            since: new Date(currentHour + 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours from now
            till: new Date(currentHour + 3 * 60 * 60 * 1000).toISOString(),   // 3 hours from now
            category: "Talk Show",
            rating: "PG"
          }
        ]
      }
    ]
  };
}

// Generate the data
const correctedEPGData = generateCurrentEPGData();

console.log("✅ CORRECTED EPG DATA FOR COPY/PASTE:");
console.log("Replace your existing epgData with this:");
console.log(JSON.stringify(correctedEPGData, null, 2));

// Schedule preview
console.log("\n📅 PROGRAM SCHEDULE PREVIEW:");
correctedEPGData.timeline.forEach(channel => {
  console.log(`\n🎬 ${channel.programTitle}:`);
  channel.data.forEach(program => {
    const start = new Date(program.since);
    const end = new Date(program.till);
    const now = new Date();
    
    let status = "🕐 UPCOMING";
    if (now >= start && now < end) status = "🔴 LIVE NOW";
    else if (now >= end) status = "✅ ENDED";
    
    console.log(`  ${status} | ${program.title}`);
    console.log(`    📅 ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`);
  });
});

console.log("\n🔧 WHAT WAS WRONG WITH YOUR ORIGINAL DATA:");
console.log("- Your dates were from January 24, 2024 (almost a year old!)");
console.log("- EPG components expect programs around the current time");
console.log("- Programs from the past don't show in the timeline view");

console.log("\n✨ WHAT'S FIXED IN THIS DATA:");
console.log("- All timestamps are based on the current time");
console.log("- Some programs are currently LIVE (will show orange)");
console.log("- Timeline will display properly with visible program blocks");
console.log("- Modal popup positioning is now fixed and centered");

// Export for browser use
if (typeof window !== 'undefined') {
  window.correctedEPGData = correctedEPGData;
  console.log("\n💾 Data is now available as window.correctedEPGData");
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = correctedEPGData;
}