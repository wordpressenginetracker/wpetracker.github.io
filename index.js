const fetchSitesData = async () => {
    const response = await fetch( 'domains.csv' );

    if ( ! response.ok ) {
      throw new Error( 'Failed to fetch CSV file' );
    }

    const text = await response.text();
    const rows = text.split( '\n' );

    return { text, rows };
}

const fetchSitesCount = async () => {
  const jsonData = await fetch( 'site-count.json' );
  const body = await jsonData.json();
  const { siteCount } = body;

  return siteCount;
}

const formatNumber = ( number, shouldHaveDecimals = true ) => {
  if ( ! number ) {
    return '';
  }

  const roundedNumber = Math.ceil( number / 10 ) * 10;

  if ( number < 100000 ) {
    return roundedNumber.toLocaleString();
  }

  const numberString = Math.floor( roundedNumber / 1000 ).toLocaleString();
  const decimalString = Math.floor( ( roundedNumber % 1000 ) / 100 );

  if ( shouldHaveDecimals ) {
    return `${ numberString }.${ decimalString}K`;
  }

  return `${ numberString }K`;
}

function triggerRecentlyMovedAnimation() {
  const site = document.querySelector(".recently-moved");

  const keyframes = [
    { transform: 'translateY(24px)', opacity: 0 },
    { transform: 'translateY(0)', opacity: 1, offset: 0.05 },
    { transform: 'translateY(0)', opacity: 1, offset: 0.95 },
    { transform: 'translateY(-24px)', opacity: 0 }
  ];

  const options = {
    duration: 4000,
    iterations: 1,
  };

  site.animate(keyframes, options);
}

function getTimeSinceMoved(date) {
  // Parse the input date
  const inputDate = new Date(date + 'Z');
  const now = new Date();

  // Calculate the difference in milliseconds
  const diffMs = now - inputDate;

  // Convert milliseconds to seconds and hours
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  const pluralMinutes = diffMinutes > 1 ? 's' : '';
  const pluralHours = diffHours > 1 ? 's' : '';

  if ( diffHours > 0 ) {
    return `${diffHours}hr${pluralHours}, ${diffMinutes % 60}min${pluralMinutes} ago`;
  }

  return `${diffMinutes}mins ago`;
}

function initRecentlyMoved() {
  fetch("site-count.json")
    .then((response) => response.json())
    .then(async (data) => {
      const hostsRes = await fetch('hosts.json');
      const hosts = await hostsRes.json();

      const urls = data.recentlyMoved.map(item => item.domain_name);
      const hostData = data.recentlyMoved.map(item => {
        return {
          'host': item?.destination ?? 'Unknown host',
          'image': hosts?.[item.destination]?.image ?? null,
          'time': item?.date ?? 'Just now'
        }
      });
      const site = document.querySelector(".recently-moved");

      let currentIndex = 0;

      function getDomainMarkup( url, time ) {
        return `
            <div class="recently-moved-site">
                <a class="source-serif-4-text" href="https://${url}" target="_blank">
                  ${url}
                  <img src="images/arrow-up-right.svg" alt="→" />
                </a>
                ${ time ? 
                `<p class-"recently-moved-site__timestamp">
                  ${time}
                </p>`
                : '' }
            </div>
        `;
      }

      function getDestinationMarkup( imageSrc, host ) {
        return `
            <div class="recently-moved-site-destination">
              ${ imageSrc ? '<img src="' + imageSrc + '"alt="' + host + '"/>' : '' }
              <p>${host}</p>
            </div>
        `;
      }

      function updateActivityLog() {
        const table = document.querySelector(".activity-log-data .activity-log-data__body");

        data.recentlyMoved
          .slice(0, 8)
          .forEach((data, index) => {
            const { domain_name, destination } = data;
            const imageSrc = hostData?.[index]?.['image'] ?? null;
            const time = hostData?.[index]?.['time'] ?? 'Just now';
            const timeString = time !== 'Just now' ? getTimeSinceMoved( time ) : time;
            const row = document.createElement("div");

            row.className = "activity-log-data__row";
            row.innerHTML = `
              ${getDomainMarkup( domain_name, timeString )}
              ${getDestinationMarkup( imageSrc, destination )}
            `;
            table.appendChild(row);

            const hr = document.createElement("hr");
            table.appendChild(hr);
          }
        );
      }

      function updateTicker() {
        const imageSrc = hostData?.[currentIndex]?.['image'] ?? null;
        const host = hostData?.[currentIndex]?.['host'] ?? 'Unknown host';

        if ( host === 'Unknown host' ) {
          console.log( 'No data found for host: ', host );
        }

        site.innerHTML = `
          ${ getDomainMarkup( urls[currentIndex] ) }
          ${ getDestinationMarkup( imageSrc, host ) }
        `

        currentIndex = (currentIndex + 1) % urls.length;
        triggerRecentlyMovedAnimation();
      }

      updateActivityLog();
      updateTicker();
      setInterval(updateTicker, 4000);
    });
}

function initChart() {
  fetch("site-count.json")
    .then((response) => response.json())
    .then((data) => {
      const stats = data.dailyTotalStat;
      const barsContainer = document.querySelector(".bars-container");
      const topChartValue = document.getElementById("top-chart-value");
      const bottomChartValue = document.getElementById("bottom-chart-value");

      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      barsContainer.appendChild(tooltip);

      let tooltipTimeout;

      const entries = Object.entries(stats);

      const beginningSiteCount = entries[0][1];
      const endingSiteCount = entries[entries.length - 1][1];

      const beginningChartNumber = beginningSiteCount;
      const endingChartNumber = beginningChartNumber - ( ( beginningSiteCount - endingSiteCount ) * 3 );
      const delta = beginningChartNumber - endingChartNumber;

      topChartValue.textContent = formatNumber(beginningChartNumber, false);
      bottomChartValue.textContent = formatNumber(endingChartNumber, false);

      // Create bars
      entries.forEach(([date, value], index) => {
        const adjustedValue = value - endingChartNumber;
        const height = (adjustedValue / delta) * 100;
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = `${height}%`;
        bar.dataset.value = value;
        bar.style.animationDelay = `${index * 30}ms`;
        barsContainer.appendChild(bar);
      });

      // Update tooltip on mousemove
      const updateTooltip = (e) => {
        clearTimeout(tooltipTimeout);
        tooltip.style.opacity = "1";

        const barsContainerRect = barsContainer.getBoundingClientRect();
        const relativeX = e.clientX - barsContainerRect.left;
        const barWidth = barsContainerRect.width / entries.length;
        const barIndex = Math.min(
          Math.floor((relativeX + barWidth / 2) / barWidth),
          entries.length - 1
        );

        if (barIndex >= 0 && barIndex < entries.length) {
          const bar = barsContainer.children[barIndex + 1];
          if (bar && bar.classList.contains("bar")) {
            tooltip.style.left = `${e.clientX - barsContainerRect.left}px`;
            tooltip.textContent = formatNumber( bar.dataset.value );
          }
        }
      };

      // Handle mouse leave
      barsContainer.addEventListener("mouseleave", () => {
        tooltipTimeout = setTimeout(() => {
          tooltip.style.opacity = "0";
        }, 500);
      });

      barsContainer.addEventListener("mousemove", updateTooltip);
    });
}

function animateNumber(element, start, end, duration = 500) {
  const startTime = performance.now();
  const startNumber = parseInt(start);
  const endNumber = parseInt(end);
  const difference = endNumber - startNumber;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function for smooth animation
    const easeOutQuad = 1 - Math.pow(1 - progress, 2);
    const currentNumber = Math.floor(startNumber + difference * easeOutQuad);

    element.textContent = formatNumber(currentNumber);

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function initTopDestinations() {
  fetch("site-count.json")
    .then((response) => response.json())
    .then( async (data) => {
      const hostElement = document.querySelector(".host");
      const sitesCount = document.querySelector("#sites-count");

      // Get top 7 destinations
      const topFive = Object.entries(data.topDestinationHosts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

      const hostsRes = await fetch('hosts.json');
      const hosts = await hostsRes.json();

      topFive.forEach(([host, count]) => {
        const hostData = hosts[host];
        const item = document.createElement("li");
        item.className = "host-item";

        if ( ! hostData ) {
          console.log( 'No data found for host: ', host );
          return;
        }

        item.innerHTML = `
          <a
            href="${hostData.href}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${host}${' '}${hostData['has_promo'] ? '<span class="promo">(Promo)</span>' : ''}
            <img src="images/arrow-up-right-black.svg" alt="→" />
          </a>
          
        `;

        item.addEventListener("mouseenter", () => {
          animateNumber(
            sitesCount,
            sitesCount.textContent.replace(/[^\d]/g, ""),
            count
          );
        });

        item.addEventListener("mouseleave", () => {
          animateNumber(
            sitesCount,
            sitesCount.textContent.replace(/[^\d]/g, ""),
            data.siteCount
          );
        });

        hostElement.appendChild(item);
      });
    });
}

window.addEventListener("load", async () => {
  const sitesCount = await fetchSitesCount();
  const sitesCountElement = document.getElementById("sites-count");
  sitesCountElement.textContent = formatNumber(sitesCount);
});

document.addEventListener("DOMContentLoaded", () => {
  initRecentlyMoved();
  initChart();
  initTopDestinations();
}); 
