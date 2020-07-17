const MAIN_SELECTOR = "#wikiArticle";

const fetched = new Map();

function main() {
  // document.body.style.border = "3px solid orange";

  const main = document.querySelector(MAIN_SELECTOR);

  if (!main) {
    console.warn(`Can't find selector '${MAIN_SELECTOR}'`);
    return;
  } else {
    let githubURL = null;
    [...document.querySelectorAll(".document-meta a[href]")].forEach((a) => {
      if (!a.href) return;
      var url = new URL(a.href);
      if (
        url.hostname === "github.com" &&
        url.pathname.startsWith("/mdn/yari/")
      ) {
        const owner = url.pathname.split("/")[1];
        const repo = url.pathname.split("/")[2];
        const path = url.pathname.split("/").slice(5).join("/");
        githubURL = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      }
    });
    if (!githubURL) {
      console.log("Can't find GitHub for this page");
      return;
    }

    const tooltip = document.createElement("div");
    tooltip.role = "tooltip";
    //   tooltip.textContent = "I'm a tooltip";
    tooltip.style = `
    position:absolute;
    background-color: white;
    z-index: 1001;
    opacity: 0.93;
    left: -325px;
    border: 1px solid rgb(200, 200, 200);
    padding: 10px; border-radius: 10px;
    box-shadow: rgba(0, 0, 0, 0.3) 0 2px 10px;
    width: 300px;
`.trim();
    const tooltipHead = document.createElement("p");
    tooltipHead.textContent = "You selected...";
    tooltipHead.style = `
      font-weight: bold;
      margin-bottom: 1px;
    `.trim();
    tooltip.appendChild(tooltipHead);
    const tooltipCode = document.createElement("code");
    tooltipCode.textContent = "";
    tooltip.appendChild(tooltipCode);

    const tooltipError = document.createElement("p");
    tooltipError.textContent = "";
    tooltipError.style = `
      color: red;
      font-size: 80%;
      font-weight: bold;
      display: none;
    `.trim();
    tooltip.appendChild(tooltipError);

    const tooltipLink = document.createElement("a");
    tooltipLink.href = "#";
    tooltipLink.textContent = "Open file on GitHub";
    tooltipLink.target = "_blank";
    tooltipLink.rel = "noopener noreferer"; // XXX spelled correctly?

    const tooltipCandidates = document.createElement("ul");
    tooltipCandidates.style = `
      padding-left: 10px;
      display: none;
      font-size: 70%;
    `;
    tooltip.appendChild(tooltipCandidates);

    const tooltipFooter = document.createElement("p");
    tooltipFooter.style = `
      border-top: 1px solid #555;
      text-align: center;
      font-size: 80%;
      margin: 30px 0 5px 0;
      padding: 5px;
      display: none;
    `.trim();
    tooltipFooter.appendChild(tooltipLink);
    tooltip.appendChild(tooltipFooter);

    function updateData(data, selectedString) {
      if (data.encoding !== "base64") {
        throw new Error(`Unrecognized data.encoding: ${data.encoding}`);
      }
      const decodedData = window.atob(data.content);
      console.log(decodedData);
      let frontmatterMarkers = 0;
      const candidates = [];
      [...tooltipCandidates.querySelectorAll("li")].forEach((e) => {
        e.parentNode.removeChild(e);
      });
      decodedData.split("\n").forEach((line, i) => {
        if (frontmatterMarkers >= 2) {
          if (line.includes(selectedString)) {
            candidates.push({ line, i: i + 1 });
            const c = document.createElement("li");
            c.style = `
              list-style: none;
            `.trim();
            const a = document.createElement("a");
            a.href = `${data._links.html}#L${i + 1}`;
            const L = document.createElement("i");
            L.style = `
              text-decoration: none;
              padding-right: 2px;
              color: #666;
            `.trim();
            L.textContent = `#${i + 1}`;
            a.appendChild(L);
            const s = document.createElement("span");
            s.textContent = getSnippet(line, selectedString, 45);
            a.appendChild(s);
            a.target = "_blank";
            a.rel = "noopener noreferer"; // XXX spelled correctly?
            c.appendChild(a);
            tooltipCandidates.appendChild(c);
            tooltipCandidates.style.display = "block";
          }
        } else if (line === "---") {
          frontmatterMarkers++;
        }
      });

      tooltipLink.textContent = "On GitHub";
      tooltipLink.href = data._links.html;
      tooltipFooter.style.display = "block";
    }

    main.addEventListener("mouseup", (event) => {
      if (event.target === tooltip || event.target.parentNode === tooltip) {
        return;
      }
      const selectedString = getSelectedText();
      console.log(event.target, event.target.name, selectedString);
      if (selectedString.trim()) {
        event.target.parentNode.insertBefore(tooltip, event.target);
        // event.target.appendChild(tooltip);

        if (fetched.has(githubURL)) {
          updateData(fetched.get(githubURL), selectedString);
        } else {
          fetchGithubURL(githubURL)
            .then((response) => {
              if (response.ok) {
                response.json().then((data) => {
                  console.log("DATA:", data);
                  fetched.set(githubURL, data);
                  updateData(data, selectedString);
                });
              } else {
                throw new Error(
                  `${response.status} is not OK on ${response.url}`
                );
              }
            })
            .catch((error) => {
              tooltipError.textContent = error.toString();
              tooltipError.style.display = "block";
            });
        }

        tooltip.style.display = "block";
        tooltip.querySelector("code").textContent = selectedString;
      } else {
        tooltip.style.display = "none";
      }
    });
  }

  function getSelectedText() {
    if (window.getSelection) {
      return window.getSelection().toString();
    } else if (document.selection) {
      return document.selection.createRange().text;
    }
    return "";
  }
}

function fetchGithubURL(url) {
  const headers = {
    Origin: document.location.hostname,
    Referer: document.location.href,
  };
  console.log("HEADERS:", headers);
  return fetch(url, {
    headers,
  });
}

function getSnippet(haystack, needle, maxLength = 30) {
  const indexOf = haystack.indexOf(needle);
  if (indexOf === -1) {
    return `${haystack.substring(0, maxLength)}…`;
  }
  let right = indexOf + needle.length;
  let left = indexOf;
  let even = false;
  let stuckLeft = false;
  let stuckRight = false;
  while (right - left < maxLength && (!stuckLeft || !stuckRight)) {
    if (even) {
      if (left > 0) {
        left--;
        if (!left) {
          stuckLeft = true;
        }
      } else {
        stuckLeft = true;
      }
    } else {
      if (right < haystack.length) {
        right++;
        if (right === haystack.length) {
          stuckRight = true;
        }
      } else {
        stuckRight = true;
      }
    }
    even = !even;
  }

  return (
    (!stuckLeft ? "…" : "") +
    haystack.substring(left, right).trim() +
    (!stuckRight ? "…" : "")
  );
}
// async function fetchGithubURL(url) {
//   try {
//     console.log(`Trying to fetch ${url}`);
//     const response = await fetch(url);
//     console.log(response);
//   } catch (ex) {
//     console.error(`Unable to fetch ${url}`);
//     throw ex;
//   }
// }

(function () {
  if (document.querySelector(MAIN_SELECTOR)) {
    main();
  } else {
    setTimeout(main, 1000);
  }
})();
