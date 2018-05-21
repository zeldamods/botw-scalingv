async function loadConfig() {
  const res = await fetch("./game_files/1.5.0_LevelSensor.json");
  const raw = await res.json();
  let config = raw;
  config.weapon_tables = [];
  for (let table of config.weapon) {
    if (!table.not_rank_up) {
      config.weapon_tables.push(table);
      continue;
    }
    let subtables = {};
    for (let actor of table.actors) {
      if (!subtables[actor.name])
        subtables[actor.name] = [];
      subtables[actor.name].push(actor);
    }
    for (let subtableName of Object.keys(subtables)) {
      if (subtables[subtableName].length === 1)
        continue;
      config.weapon_tables.push({
        actorType: table.actorType,
        actors: subtables[subtableName],
        not_rank_up: false,
        series: table.series,
      });
    }
  }
  return config;
}

function getParams(query) {
  if (!query) {
    return {};
  }

  return (/^[?#]/.test(query) ? query.slice(1) : query)
    .split('&')
    .reduce((params, param) => {
      let [ key, value ] = param.split('=');
      params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
      return params;
    }, {});
}

async function main() {
  const params = getParams(window.location.search);
  const app = new Vue({
    el: '#app',
    data: {
      points: parseInt(params.startPoints, 10) || 0,
      actorType: params.actorType,
      config: await loadConfig(),
    },
    created: async function () {
      const reachedLast = this.updatePoints();

      if (this.actorType)
        await this.preloadImages(this.actorType);
      if (!reachedLast)
        setTimeout(() => window.requestAnimationFrame(this.autoScale), 3000);
    },
    methods: {
      imagePath: (item) => `./game_files/item_pictures/${item}.png`,
      preloadImages: async function (actorType) {
        const loadImage = path => new Promise((resolve, reject) => {
          const img = new Image();
          img.src = path;
          img.onload = () => resolve();
          img.onerror = () => reject();
        });

        let promises = [];
        for (let table of this.config.weapon) {
          if (actorType && table.actorType !== actorType) {
            continue;
          }
          for (let actor of table.actors) {
            promises.push(loadImage(this.imagePath(actor.name)));
          }
          await Promise.all(promises);
        }
      },
      autoScale: function () {
        this.points += 5;
        const reachedLast = this.updatePoints();
        if (!reachedLast)
          window.requestAnimationFrame(this.autoScale);
      },
      updatePoints: function () {
        let reachedLast = true;
        for (let table of this.config.weapon_tables) {
          if (table.actorType !== this.actorType) {
            continue;
          }

          for (let actor of table.actors) {
            actor.active = false;
          }

          let i = -1;
          for (let j = 0; j < table.actors.length; ++j) {
            if (this.points * this.config.setting.Level2WeaponPower > table.actors[j].value) {
              i = j;
              break;
            }
          }
          if (i === -1) {
            table.actors[0].active = true;
            reachedLast = this.points * this.config.setting.Level2WeaponPower > table.actors[0].value;
            continue;
          }

          let entry;
          do {
            entry = table.actors[i];
            if (this.points * this.config.setting.Level2WeaponPower <= entry.value)
              break;
            ++i;
          } while (i < table.actors.length);

          entry.active = true;
          if (i < table.actors.length - 1) {
            reachedLast = false;
          }
        }
        return reachedLast;
      },
    },
  });
}

main().then(() => document.getElementById("app").className = "").catch((error) => {
  alert("An error has occurred. Please reload the page.");
  console.error(error);
});
