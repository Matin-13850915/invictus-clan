
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

function validateFilters(filters) {
  if (
    !filters ||
    typeof filters !== "object" ||
    Array.isArray(filters)
  ) {
    throw new Error("فیلترهای جستجو معتبر نیستند.");
  }
}

function isActiveFilter(value) {
  return value === undefined ||
    typeof value === "boolean";
}

// جستجوی اعضا
export function searchMembers(members, searchTerm, filters = {}) {
  if (!Array.isArray(members)) return [];

  validateFilters(filters);

  if (!isActiveFilter(filters.active)) {
    throw new Error("فیلتر وضعیت عضو معتبر نیست.");
  }

  return members.filter(member => {
    if (!member || typeof member !== "object") return false;

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

// جستجوی جنگ‌ها
export function searchWars(wars, searchTerm, filters = {}) {
  if (!Array.isArray(wars)) return [];

  validateFilters(filters);

  return wars.filter(war => {
    if (!war || typeof war !== "object") return false;

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

  return items.filter(item => {
    if (!item || typeof item !== "object") return false;

    return matchesText(
      item,
      ["title", "content", "authorName"],
      searchTerm
    );
  });
}

// جستجوی درخواست‌های عضویت
export function searchApplications(items, searchTerm, filters = {}) {
  if (!Array.isArray(items)) return [];

  validateFilters(filters);

  return items.filter(item => {
    if (!item || typeof item !== "object") return false;

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

  return teams.filter(team => {
    if (!team || typeof team !== "object") return false;

    return matchesText(
      team,
      ["name", "description", "type"],
      searchTerm
    );
  });
}

// جستجوی تیکت‌ها
export function searchTickets(tickets, searchTerm, actor) {
  if (!actor?.uid) {
    throw new Error("ابتدا وارد حساب خود شوید.");
  }

  if (!Array.isArray(tickets)) return [];

  const visibleTickets = tickets.filter(ticket => {
    if (!ticket || typeof ticket !== "object") return false;

    if (actor.role === "admin" || actor.role === "leader") {
      return true;
    }

    if (actor.role === "tester") {
      return (
        ticket.assignedTo === actor.uid ||
        ticket.assignedTester === actor.uid
      );
    }

    return ticket.uid === actor.uid;
  });

  return visibleTickets.filter(ticket =>
    matchesText(
      ticket,
      ["title", "subject", "message", "status"],
      searchTerm
    )
  );
  }
       
