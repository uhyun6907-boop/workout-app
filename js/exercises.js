// Seed exercise library: "Name|BodyPart"
(function (g) {
  const SEED = `Ab Wheel|Core
Cable Crunch|Core
Crunch|Core
Crunch (Machine)|Core
Decline Crunch|Core
Bicycle Crunch|Core
Sit Up|Core
Jackknife Sit Up|Core
Russian Twist|Core
Plank|Core
Side Plank|Core
Hanging Leg Raise|Core
Leg Raise|Core
Knee Raise (Captain's Chair)|Core
Toes To Bar|Core
Mountain Climber|Core
Torso Rotation (Machine)|Core
Aerobics|Cardio
Running|Cardio
Running (Treadmill)|Cardio
Walking|Cardio
Cycling|Cardio
Cycling (Indoor)|Cardio
Rowing (Machine)|Cardio
Elliptical Trainer|Cardio
Stair Stepper|Cardio
Jump Rope|Cardio
Swimming|Cardio
Hiking|Cardio
Arnold Press (Dumbbell)|Shoulders
Overhead Press (Barbell)|Shoulders
Overhead Press (Dumbbell)|Shoulders
Overhead Press (Smith Machine)|Shoulders
Seated Overhead Press (Dumbbell)|Shoulders
Seated Overhead Press (Barbell)|Shoulders
Shoulder Press (Machine)|Shoulders
Push Press|Shoulders
Lateral Raise (Dumbbell)|Shoulders
Lateral Raise (Cable)|Shoulders
Lateral Raise (Machine)|Shoulders
Front Raise (Dumbbell)|Shoulders
Front Raise (Barbell)|Shoulders
Reverse Fly (Dumbbell)|Shoulders
Reverse Fly (Machine)|Shoulders
Reverse Fly (Cable)|Shoulders
Face Pull (Cable)|Shoulders
Upright Row (Dumbbell)|Shoulders
Upright Row (Barbell)|Shoulders
Upright Row (Cable)|Shoulders
Shrug (Dumbbell)|Shoulders
Shrug (Barbell)|Shoulders
Around the World|Chest
Bench Press (Barbell)|Chest
Bench Press (Dumbbell)|Chest
Bench Press (Smith Machine)|Chest
Bench Press (Cable)|Chest
Incline Bench Press (Barbell)|Chest
Incline Bench Press (Dumbbell)|Chest
Incline Bench Press (Smith Machine)|Chest
Decline Bench Press (Barbell)|Chest
Decline Bench Press (Dumbbell)|Chest
Floor Press (Barbell)|Chest
Chest Dip|Chest
Chest Dip (Assisted)|Chest
Chest Fly (Dumbbell)|Chest
Incline Chest Fly (Dumbbell)|Chest
Chest Fly (Band)|Chest
Chest Press (Machine)|Chest
Incline Chest Press (Machine)|Chest
Cable Crossover|Chest
Pec Deck (Machine)|Chest
Push Up|Chest
Push Up (Knees)|Chest
Pullover (Dumbbell)|Chest
Back Extension|Back
Back Extension (Machine)|Back
Deadlift (Barbell)|Back
Deadlift (Dumbbell)|Back
Deadlift (Trap Bar)|Back
Rack Pull (Barbell)|Back
Good Morning (Barbell)|Back
Pendlay Row (Barbell)|Back
Bent Over Row (Barbell)|Back
Bent Over Row (Dumbbell)|Back
Bent Over One Arm Row (Dumbbell)|Back
Seated Row (Cable)|Back
Seated Row (Machine)|Back
Iso-Lateral Row (Machine)|Back
T Bar Row|Back
Inverted Row|Back
Lat Pulldown (Cable)|Back
Lat Pulldown (Machine)|Back
Lat Pulldown - Underhand (Cable)|Back
Straight Arm Pulldown (Cable)|Back
Pull Up|Back
Pull Up (Assisted)|Back
Pull Up (Band)|Back
Chin Up|Back
Chin Up (Assisted)|Back
Muscle Up|Back
Bicep Curl (Barbell)|Arms
Bicep Curl (Dumbbell)|Arms
Bicep Curl (Cable)|Arms
Bicep Curl (Machine)|Arms
EZ Bar Curl|Arms
Hammer Curl (Dumbbell)|Arms
Hammer Curl (Cable)|Arms
Preacher Curl (Barbell)|Arms
Preacher Curl (Dumbbell)|Arms
Preacher Curl (Machine)|Arms
Concentration Curl (Dumbbell)|Arms
Incline Curl (Dumbbell)|Arms
Reverse Curl (Barbell)|Arms
Wrist Curl (Barbell)|Arms
Skullcrusher (Barbell)|Arms
Skullcrusher (Dumbbell)|Arms
Triceps Pushdown (Cable - Straight Bar)|Arms
Triceps Pushdown (Cable - Rope)|Arms
Triceps Extension (Cable)|Arms
Triceps Extension (Dumbbell)|Arms
Triceps Extension (Barbell)|Arms
Triceps Dip|Arms
Triceps Dip (Assisted)|Arms
Bench Dip|Arms
Bench Press - Close Grip (Barbell)|Arms
Kickback (Dumbbell)|Arms
Squat (Barbell)|Legs
Front Squat (Barbell)|Legs
Box Squat (Barbell)|Legs
Pause Squat (Barbell)|Legs
Squat (Smith Machine)|Legs
Squat (Dumbbell)|Legs
Goblet Squat (Kettlebell)|Legs
Goblet Squat (Dumbbell)|Legs
Hack Squat|Legs
Hack Squat (Machine)|Legs
Air Squat|Legs
Leg Press|Legs
Leg Extension (Machine)|Legs
Lying Leg Curl (Machine)|Legs
Seated Leg Curl (Machine)|Legs
Romanian Deadlift (Barbell)|Legs
Romanian Deadlift (Dumbbell)|Legs
Stiff Leg Deadlift (Barbell)|Legs
Sumo Deadlift (Barbell)|Legs
Lunge (Barbell)|Legs
Lunge (Dumbbell)|Legs
Lunge (Bodyweight)|Legs
Walking Lunge (Dumbbell)|Legs
Bulgarian Split Squat|Legs
Bulgarian Split Squat (Dumbbell)|Legs
Step-up (Dumbbell)|Legs
Hip Thrust (Barbell)|Legs
Hip Thrust (Machine)|Legs
Glute Bridge|Legs
Glute Kickback (Machine)|Legs
Hip Abductor (Machine)|Legs
Hip Adductor (Machine)|Legs
Standing Calf Raise (Machine)|Legs
Standing Calf Raise (Dumbbell)|Legs
Seated Calf Raise (Machine)|Legs
Calf Press on Leg Press|Legs
Box Jump|Legs
Ball Slams|Full Body
Burpee|Full Body
Clean (Barbell)|Olympic
Power Clean|Olympic
Hang Clean (Barbell)|Olympic
Clean and Jerk (Barbell)|Olympic
Snatch (Barbell)|Olympic
Thruster (Barbell)|Full Body
Kettlebell Swing|Full Body
Turkish Get Up|Full Body
Farmers Walk|Full Body
Battle Ropes|Full Body`;

  const BODY_PARTS = ['Core', 'Arms', 'Back', 'Chest', 'Legs', 'Shoulders', 'Full Body', 'Olympic', 'Cardio', 'Other'];
  const CATEGORIES = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Kettlebell', 'Band', 'Weighted Bodyweight', 'Assisted Bodyweight', 'Reps Only', 'Cardio', 'Duration', 'Other'];

  function guessCategory(name, body) {
    const m = /\(([^)]*)\)\s*$/.exec(name);
    const p = m ? m[1].toLowerCase() : '';
    if (body === 'Cardio') return 'Cardio';
    if (/plank|hold|hang\b|wall sit/i.test(name)) return 'Duration';
    if (p.includes('barbell') || p.includes('trap bar') || p.includes('ez')) return 'Barbell';
    if (p.includes('dumbbell')) return 'Dumbbell';
    if (p.includes('cable')) return 'Cable';
    if (p.includes('machine') || p.includes('smith') || /leg press|hack squat|pec deck/i.test(name)) return 'Machine';
    if (p.includes('kettlebell') || /kettlebell/i.test(name)) return 'Kettlebell';
    if (p.includes('band')) return 'Band';
    if (p.includes('assisted')) return 'Assisted Bodyweight';
    if (/pull up|chin up|dip|push up|muscle up|back extension|sit up|crunch|leg raise|lunge|squat|burpee|twist/i.test(name)) return 'Weighted Bodyweight';
    if (/curl|row|press|raise|fly/i.test(name)) return 'Other';
    return 'Reps Only';
  }

  function guessBody(name) {
    const n = name.toLowerCase();
    const rules = [
      [/run|walk|cycl|bike|row(ing)? \(machine\)|ellipt|stair|swim|jump rope|aerobic|hik|treadmill/, 'Cardio'],
      [/crunch|sit up|plank|ab |abs|core|twist|leg raise|knee raise|toes to bar|wheel|oblique|복근/, 'Core'],
      [/curl|tricep|skull|kickback|bench press - close|close grip|dip \(|triceps|forearm|wrist/, 'Arms'],
      [/squat|lunge|leg |calf|glute|hip |thrust|split|step-up|romanian|stiff leg|sumo|box jump|adductor|abductor/, 'Legs'],
      [/bench|chest|fly|pec|push up|crossover|pullover|chest dip/, 'Chest'],
      [/overhead|shoulder|lateral|front raise|reverse fly|face pull|upright|shrug|arnold|military|push press/, 'Shoulders'],
      [/row|pull|chin|lat |deadlift|back ext|good morning|rack pull/, 'Back'],
      [/clean|snatch|jerk/, 'Olympic'],
      [/burpee|thruster|swing|slam|farmer|get up/, 'Full Body'],
    ];
    for (const [re, b] of rules) if (re.test(n)) return b;
    return 'Other';
  }

  const SEED_LIST = SEED.split('\n').map(l => {
    const [name, body] = l.split('|');
    return { name, body, cat: guessCategory(name, body) };
  });

  g.EXDB = { SEED_LIST, BODY_PARTS, CATEGORIES, guessBody, guessCategory };
  if (typeof module !== 'undefined') module.exports = g.EXDB;
})(typeof window !== 'undefined' ? window : globalThis);
