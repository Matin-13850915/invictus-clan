
function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

function matchesText(record, fields, searchTerm) {
  const term = normalize(searchTerm);

  if (!term) return true;

  return fields.some(field =>
    normalize(record?.[field]).includes(term)
  );
}

// جستجوی اعضا
export function searchMembers(members, searchTerm, filters = {}) {
  if (!Array.isArray(members)) return [];

  return members.filter(member => {
    const textMatch = matchesText(
      member,
      ["gameName", "displayName", "uid"],
      searchTerm
    );

    const roleMatch = !filters.role ||
      member.role === filters.role;

    const statusMatch = filters.active === undefined ||
      member.active === filters.active;

    return textMatch && roleMatch && statusMatch;
  });
}

// جستجوی مسابقات
export function searchWars(wars, searchTerm, filters = {}) {
  if (!Array.isArray(wars)) return [];

  return wars.filter(war => {
    const textMatch = matchesText(
      war,
      ["opponent", "type", "description"],
      searchTerm
    );

    const statusMatch = !filters.status ||
      war.status === filters.status;

    return textMatch && statusMatch;
  });
}

// جستجوی اطلاعیه‌ها
export function searchAnnouncements(items, searchTerm) {
  if (!Array.isArray(items)) return [];

  return items.filter(item =>
    matchesText(item, ["title", "content", "authorName"], searchTerm)
  );
}

// جستجوی درخواست‌های عضویت
export function searchApplications(items, searchTerm, filters = {}) {
  if (!Array.isArray(items)) return [];

  return items.filter(item => {
    const textMatch = matchesText(
      item,
      ["gameName", "realName", "email", "uid"],
      searchTerm
    );

    const statusMatch = !filters.status ||
      item.status === filters.status;

    const typeMatch = !filters.type ||
      item.applicationType === filters.type;

    return textMatch && statusMatch && typeMatch;
  });
}

// جستجوی تیم‌ها
export function searchTeams(teams, searchTerm) {
  if (!Array.isArray(teams)) return [];

  return teams.filter(team =>
    matchesText(team, ["name", "description", "type"], searchTerm)
  );
}

// جستجوی تیکت‌ها
export function searchTickets(tickets, searchTerm, actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }

  if (!Array.isArray(tickets)) return [];

  const visibleTickets = tickets.filter(ticket => {
    if (actor.role === "admin") return true;
    if (actor.role === "leader") return true;

    return ticket.uid === actor.uid ||
      ticket.assignedTo === actor.uid;
  });

  return visibleTickets.filter(ticket =>
    matchesText(
      ticket,
      ["title", "subject", "message", "status"],
      searchTerm
    )
  );
}
