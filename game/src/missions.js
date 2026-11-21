// Palm City — the story: seven jobs that take you from a borrowed car to the top of the
// coast, each with a briefing, a marker, and a payout.
//
// The chain is deliberately simple to read: every job has a briefing, an objective the
// world checks each step, and a reward. Missions are declarative data plus a small
// updater per job.
(function (global) {
  'use strict';

  const PC = global.PC;

  /**
   * The jobs. `anchor` names a city anchor the marker sits on, `objective` says what the
   * player must do, and `reward` is the cash on completion.
   */
  const JOBS = [
    {
      id: 'first-light',
      title: 'First Light',
      contact: 'Rook',
      reward: 250,
      anchor: 'garage',
      briefing:
        'Rook leans on the roller door of Rustline Garage with a coffee he did not pay for. "You want work. Fine. My cousin left a car at Coral Pier and the tide is coming in. Bring it back before the salt takes it. Do not scratch it. Do not get cute with the police."',
      objective: 'Steal the car at Coral Pier and drive it to Rustline Garage.',
      hint: 'Find the yellow marker at Coral Pier, get in the car, and drive it back.',
    },
    {
      id: 'counter-service',
      title: 'Counter Service',
      contact: 'Rook',
      reward: 400,
      anchor: 'bank',
      briefing:
        '"Sunstate Bank, corner of Fifth. They count the takings at four. I want the drawer, not the vault, not a hostage, not a headline. In and out before the guard finishes his coffee."',
      objective: 'Rob Sunstate Bank: reach the counter, take the cash, and get clear.',
      hint: 'Walk into the marker at Sunstate Bank, then leave the block before the heat settles.',
    },
    {
      id: 'night-shift',
      title: 'Night Shift',
      contact: 'Marisol',
      reward: 650,
      anchor: 'docks',
      briefing:
        'Marisol does not look up from her phone. "North Docks, container row nine. A crate with my name on it is sitting where it should not be. Two men will tell you it is theirs. They are lying. I do not care how you settle it, only that the crate moves."',
      objective: 'Clear the docks and secure the crate at North Docks.',
      hint: 'The marker is the container. Whoever is standing on it is in your way.',
    },
    {
      id: 'the-tip',
      title: 'The Tip',
      contact: 'Marisol',
      reward: 800,
      anchor: 'club',
      briefing:
        '"Somebody at the Neon Flamingo is selling my routes to the coast patrol. I want a name, and I want it before midnight. Go in, ask nicely, then stop asking nicely."',
      objective: 'Find the informant at the Neon Flamingo Club and take him down.',
      hint: 'The informant wears a pale jacket and does not run until you get close.',
    },
    {
      id: 'sound-check',
      title: 'Sound Check',
      contact: 'Dez',
      reward: 1100,
      anchor: 'studio',
      briefing:
        'Dez has three gold records and one unpaid debt. "Waveform Studios, the big room. A man is coming to collect a tape that is not his. Make sure the tape stays, and make sure he does not come back for it."',
      objective: 'Defend Waveform Studios: stop the collector and keep the tape.',
      hint: 'Two cars will arrive. Hold the marker until the last of them is down.',
    },
    {
      id: 'high-water',
      title: 'High Water',
      contact: 'Dez',
      reward: 1500,
      anchor: 'villa',
      briefing:
        '"Casa Marbella, the house on the hill with the white wall. The man who lives there bought my catalogue for a dollar and a threat. Go up, take the ledger off his desk, and do not use the front door."',
      objective: 'Break into Casa Marbella and take the ledger.',
      hint: 'The ledger is on the desk inside the marker. Getting out is the hard part.',
    },
    {
      id: 'last-call',
      title: 'Last Call',
      contact: 'Rook',
      reward: 3000,
      anchor: 'pier',
      briefing:
        'Rook is waiting at the end of Coral Pier with the wind in his collar. "This is the one. Every dollar we moved this month is on that boat, and the coast patrol is going to take it at dawn unless somebody persuades them otherwise. You have been the somebody all along. Bring it home."',
      objective: 'Hold Coral Pier against the coast patrol until the boat clears.',
      hint: 'Survive the assault at the pier. The clock on the HUD is the boat.',
    },
  ];

  function makeMissions(city) {
    return {
      jobs: JOBS,
      index: 0,
      state: 'idle',           // idle | briefing | active | complete | failed
      marker: null,
      timer: 0,
      progress: 0,
      targets: [],
      saved: 0,
      story: {
        completed: [],
        lastResult: null,
      },
      city,
    };
  }

  /** The job the player is on, or the last one when the chain is finished. */
  function current(m) {
    return m.jobs[Math.min(m.index, m.jobs.length - 1)];
  }

  function anchorOf(city, id) {
    return city.anchors.find((a) => a.id === id) || city.anchors[0];
  }

  /** Start the current job: set the marker and the state the world watches. */
  function begin(m, city) {
    const job = current(m);
    const anchor = anchorOf(city, job.anchor);
    m.state = 'active';
    m.timer = 0;
    m.progress = 0;
    m.targets = [];
    m.marker = { x: anchor.x, y: anchor.y, r: 44, label: job.title };

    switch (job.id) {
      case 'first-light': {
        // The car waits on the pier; the marker follows it once the player is driving.
        m.targets = [];
        m.phase = 'fetch';
        break;
      }
      case 'counter-service':
        m.phase = 'rob';
        break;
      case 'night-shift':
        m.phase = 'clear';
        m.targets = [0, 1];
        break;
      default:
        m.phase = 'reach';
    }
    return job;
  }

  /** Complete the current job and pay out. */
  function complete(m, player, onDone) {
    const job = current(m);
    m.state = 'complete';
    m.marker = null;
    m.story.completed.push(job.id);
    m.story.lastResult = job;
    player.cash += job.reward;
    m.index = Math.min(m.index + 1, m.jobs.length);
    if (onDone) onDone(job);
  }

  /**
   * Per-step mission logic. Kept small and explicit: each job reads the world and decides
   * whether its objective is met.
   */
  function update(m, state, dt) {
    if (m.state !== 'active') return;
    const { player, city } = state;
    m.timer += dt;
    const job = current(m);

    if (job.id === 'first-light') {
      if (m.phase === 'fetch') {
        const car = state.missionCar;
        if (car && player.inCar === car) {
          m.phase = 'deliver';
          const garage = anchorOf(city, 'garage');
          m.marker = { x: garage.x, y: garage.y, r: 52, label: 'Rustline Garage' };
        }
      } else if (m.phase === 'deliver') {
        const garage = anchorOf(city, 'garage');
        if (player.inCar && PC.dist(player.x, player.y, garage.x, garage.y) < 60) {
          complete(m, player, state.onMissionDone);
        }
      }
      return;
    }

    if (!m.marker) return;
    const inMarker = PC.dist(player.x, player.y, m.marker.x, m.marker.y) < m.marker.r;

    switch (job.id) {
      case 'counter-service':
        if (m.phase === 'rob' && inMarker && !player.inCar) {
          m.phase = 'escape';
          m.timer = 0;
          player.cash += 320;
          state.onCrime?.(55, 'armed robbery');
          m.marker = null;
        } else if (m.phase === 'escape' && m.timer > 6) {
          complete(m, player, state.onMissionDone);
        }
        break;

      case 'night-shift':
      case 'the-tip':
      case 'sound-check':
      case 'high-water':
        // Combat jobs: cleared when the marker is reached with no live targets near it.
        if (inMarker) {
          const liveNear = state.hostiles.filter(
            (h) => !h.dead && PC.dist(h.x, h.y, m.marker.x, m.marker.y) < 260,
          ).length;
          m.progress = Math.max(m.progress, liveNear === 0 ? 1 : 0);
          if (liveNear === 0) {
            m.holdTimer = (m.holdTimer || 0) + dt;
            if (m.holdTimer > 2.4) complete(m, player, state.onMissionDone);
          } else {
            m.holdTimer = 0;
          }
        }
        break;

      case 'last-call': {
        m.waveTimer = (m.waveTimer || 0) - dt;
        if (m.waveTimer <= 0 && m.timer < 95) {
          const angle = Math.random() * Math.PI * 2;
          state.spawnRaid(
            m.marker.x + Math.cos(angle) * 420,
            m.marker.y + Math.sin(angle) * 420,
          );
          m.waveTimer = 9;
        }
        if (m.timer > 95) complete(m, player, state.onMissionDone);
        break;
      }
    }
  }

  PC.Missions = { makeMissions, current, begin, update, complete, anchorOf, JOBS };
})(window);
