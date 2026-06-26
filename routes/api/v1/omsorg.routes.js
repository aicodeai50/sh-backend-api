const express = require("express");
const { Op } = require("sequelize");
let webpush = null;
try {
  webpush = require("web-push");
} catch (_error) {
  webpush = null;
}
const {
  User,
  OmsorgCourse,
  OmsorgActivity,
  OmsorgCheckoff,
  OmsorgComment,
  OmsorgAuditLog,
  OmsorgHealthTool,
  OmsorgDigitalSupervisionRoom,
  OmsorgDeviation,
  OmsorgImplementationState,
  OmsorgPushSubscription,
} = require("../../../database");

const ADMIN_ROLES = ["admin", "superuser", "company_admin", "instructor"];

const PLATFORM_IDEALS = [
  {
    title: "Menneskelig verdighet først",
    description:
      "Teknologi skal støtte beboere og ansatte, ikke overvåke unødig. Digitalt tilsyn er anonymisert — ikke tradisjonelt kamera.",
    practiceNote: "Fagperson vurderer alltid — teknologi støtter, erstatter ikke.",
  },
  {
    title: "Ansvarlighet og sporbarhet",
    description:
      "Viktige handlinger logges: kryssing, kommentarer, avvik og revisjonsspor. Ledere ser hvem gjorde hva og når.",
    practiceNote: "Alle moduler kobles til revisjonslogg der det er relevant.",
  },
  {
    title: "Pasientsikkerhet over automatisering",
    description:
      "Care Assistenten og AI-støtte erstatter ikke sykepleier, lege eller leder. Ved usikkerhet: lokale rutiner og fagperson.",
    practiceNote: "AI gir forslag og utkast — beslutning tas av ansvarlig rolle.",
  },
  {
    title: "Personvern by design",
    description: "GDPR, samtykke og ROS/DPIA. Ingen pasientnavn på offentlige flater. Rollebasert tilgang for ansatte og ledere.",
    practiceNote: "Personvern-fane og rutiner finnes i implementeringsmodulen.",
  },
  {
    title: "Kompetanse og forankring",
    description:
      "Opplæring M1–M6, Sensio LEARN og Qudos/MERkompetanse. Mål: 90 % opplært på tvers av 9 avdelinger.",
    practiceNote: "Opplæringslogg og kurs med kryssing dokumenterer fremdrift.",
  },
  {
    title: "Kontinuerlig forbedring",
    description:
      "Fasevis utrulling, ukesstatus mandag kl. 09:00, avvik og rapporter som læringssløyfe — ikke engangsprosjekt.",
    practiceNote: "Forbedringsplan og tilbakemeldinger kobles til ledelse.",
  },
];

const PLATFORM_MISSION_QUOTE =
  "Teknologi skal styrke beboere og ansatte — med tydelig ansvar, sporbarhet og respekt for personvern.";

const DEFAULT_HEALTH_TOOLS = [
  {
    id: "omsorgpilot-digitalt-tilsyn",
    name: "OmsorgPilot digitalt tilsyn",
    category: "digitalt_tilsyn",
    status: "klar",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "Egen modul for tilsyn, sjekklister, kryssing, kommentarer, logg og lederoversikt ved sykehjem.",
    integrationNotes: "Intern OmsorgPilot-modul. Kan senere kobles mot EPJ, velferdsteknologi og rapportering.",
  },
  {
    id: "helsenorge-digihelse",
    name: "Helsenorge / Digihelse",
    category: "nasjonal_ehelse",
    status: "krever_avtale",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "Digital dialog mellom innbygger, pårørende og kommunale helse- og omsorgstjenester.",
    integrationNotes: "Meldinger, avtaler og varsler går normalt via EPJ og nasjonale tjenester. Krever kommunal avtale og godkjent integrasjonsløp.",
    sourceUrl: "https://www.baerum.kommune.no/tjenester/helse-og-omsorg/digital-kommunikasjon---digihelse/",
  },
  {
    id: "nhn-vkp",
    name: "Norsk helsenett VKP",
    category: "nasjonal_ehelse",
    status: "krever_avtale",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "Velferdsteknologisk knutepunkt for automatisert datautveksling mellom velferdsteknologi og EPJ.",
    integrationNotes: "Relevant for digitalt tilsyn, medisineringsstøtte og trygghetsteknologi. Krever NHN/kommunal forankring.",
    sourceUrl: "https://www.nhn.no/tjenester/velferdsteknologisk-knutepunkt/leverandoroversikt",
  },
  {
    id: "kjernejournal",
    name: "Kjernejournal",
    category: "nasjonal_ehelse",
    status: "ekstern",
    baerumRelevant: true,
    digitalTilsynRelevant: false,
    description: "Nasjonal løsning for deling av sentrale helseopplysninger på tvers av virksomheter.",
    integrationNotes: "OmsorgPilot skal ikke lagre kjernejournaldata. Eventuell tilgang må skje via godkjente nasjonale løsninger.",
  },
  {
    id: "e-resept",
    name: "E-resept",
    category: "nasjonal_ehelse",
    status: "ekstern",
    baerumRelevant: true,
    digitalTilsynRelevant: false,
    description: "Nasjonal løsning for sikker håndtering av reseptinformasjon.",
    integrationNotes: "Kun relevant som ekstern referanse. Ikke aktuelt å implementere direkte i OmsorgPilot uten godkjent helsefaglig systemrolle.",
  },
  {
    id: "visma-profil",
    name: "Visma Omsorg Profil",
    category: "epj",
    status: "krever_avtale",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "Pleie- og omsorgssystem/EPJ brukt i Bærum kommune (Nordraaks vei sykehjem og øvrige enheter).",
    integrationNotes: "Bærum kommune bruker Visma Omsorg Profil — ikke Gerica. Journalføring skjer her; OmsorgPilot kobler ikke pasientdata direkte.",
  },
  {
    id: "dips-cosdoc",
    name: "DIPS CosDoc",
    category: "epj",
    status: "krever_avtale",
    baerumRelevant: false,
    digitalTilsynRelevant: true,
    description: "EPJ/PLO-system brukt i deler av kommunal helse- og omsorgstjeneste.",
    integrationNotes: "Relevant for nasjonal portefølje, men krever lokal avklaring før integrasjon.",
  },
  {
    id: "helseplattformen",
    name: "Helseplattformen",
    category: "epj",
    status: "ekstern",
    baerumRelevant: false,
    digitalTilsynRelevant: false,
    description: "Regional journalløsning i Midt-Norge.",
    integrationNotes: "Tas med for nasjonal oversikt, men er normalt ikke relevant for Bærum kommune.",
  },
  {
    id: "ks-fiks",
    name: "KS Fiks",
    category: "kommune",
    status: "planlagt",
    baerumRelevant: true,
    digitalTilsynRelevant: false,
    description: "Kommunal samhandlingsplattform og meldingsinfrastruktur for offentlige tjenester.",
    integrationNotes: "Kan bli relevant for sikker samhandling, meldinger og kommunale arbeidsflyter.",
  },
  {
    id: "trygghetsalarm",
    name: "Trygghetsalarm og sensorer",
    category: "velferdsteknologi",
    status: "planlagt",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "Trygghetsalarm, fallvarsling, bevegelsessensorer, røykvarsling og annen trygghetsteknologi.",
    integrationNotes: "Bør kobles via godkjent velferdsplattform/VKP, ikke direkte uten avtale.",
    sourceUrl: "https://www.baerum.kommune.no/tjenester/helse-og-omsorg/velferdsteknologi/",
  },
  {
    id: "digitalt-tilsyn-multisensor",
    name: "Digitalt tilsyn med multisensor",
    category: "digitalt_tilsyn",
    status: "planlagt",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "Digitalt tilsyn på rom med sanntidsinformasjon fra sensorer og varslingsløsninger.",
    integrationNotes: "OmsorgPilot kan vise oversikt, tilsynsstatus og avvik. Sensorintegrasjon krever leverandør/API og personvernvurdering.",
    sourceUrl: "https://www.baerum.kommune.no/om-barum-kommune/jobb-i-kommunen/jobb-med-digitalisering-og-ki/rivende-utvikling-innen-velferdsteknologi/",
  },
  {
    id: "lokalisering-gps",
    name: "Lokaliseringsteknologi / GPS",
    category: "velferdsteknologi",
    status: "planlagt",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "GPS/lokalisering for trygg aktivitet for personer med kognitiv svikt.",
    integrationNotes: "Krever tydelig samtykke, vedtak, tilgangsstyring og integrasjon via godkjent plattform.",
  },
  {
    id: "medisineringsstotte",
    name: "Elektronisk medisineringsstøtte",
    category: "velferdsteknologi",
    status: "planlagt",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "Elektronisk medisindispenser og varslingsflyt for riktig medisin til riktig tid.",
    integrationNotes: "Kan gi status/varsler i OmsorgPilot, men medisinsk dokumentasjon må håndteres i godkjent EPJ.",
  },
  {
    id: "kvalitetssystem",
    name: "Kvalitets- og avvikssystem",
    category: "kvalitet",
    status: "planlagt",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "Systemer for avvik, prosedyrer, internkontroll, HMS og kvalitetsforbedring.",
    integrationNotes: "OmsorgPilot kan eksportere avvikssammendrag eller lenke til etablert kvalitetssystem etter lokal avklaring.",
  },
  {
    id: "bemanning-turnus",
    name: "Turnus og bemanning",
    category: "bemanning",
    status: "planlagt",
    baerumRelevant: true,
    digitalTilsynRelevant: false,
    description: "Arbeidsplan, turnus, fravær og bemanningsoversikt.",
    integrationNotes: "Relevant for risiko og bemanningsbelastning, men må kobles via godkjent HR/turnus-API.",
  },
  {
    id: "kompetansestyring",
    name: "Kompetanse- og kursverktøy",
    category: "kompetanse",
    status: "klar",
    baerumRelevant: true,
    digitalTilsynRelevant: true,
    description: "OmsorgPilot-modul for kurs, aktiviteter, kryssing og kompetanseoversikt.",
    integrationNotes: "Intern modul er klar. Ekstern HR-/LMS-integrasjon kan legges til senere.",
  },
];

const DEFAULT_IMPLEMENTATION_STATE = {
  activeTab: "gjennomforing",
  trainingEntries: [],
  trainingForm: { name: "", department: "", module: "", count: "", notes: "" },
  weeklyLog: { week: "Uke 1", training: "", technical: "", challenges: "", nextWeek: "" },
  meetingDraft: "",
  phaseChecks: {},
  moduleChecks: {},
  workflowDone: {},
  activeWorkflowId: null,
  roomNumber: "",
  reflection: "",
  escalationText: "",
  leaderStatus: "",
  conversationStep: 0,
  configAnswers: [],
  handoverChecks: {},
  scenarioStep: 0,
  scenarioAnswer: null,
  printTemplate: null,
};

function buildOmsorgRouter() {
  const router = express.Router();

  function getIp(req) {
    return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
  }

  function pagination(req) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    return { page, limit, offset: (page - 1) * limit };
  }

  function paginated(rows, count, page, limit) {
    return {
      data: rows,
      page,
      limit,
      total: count,
      totalPages: Math.max(Math.ceil(count / limit), 1),
    };
  }

  function dateRangeWhere(req, field = "created_at") {
    const where = {};
    if (req.query.from || req.query.to) {
      where[field] = {};
      if (req.query.from) where[field][Op.gte] = new Date(String(req.query.from));
      if (req.query.to) where[field][Op.lte] = new Date(String(req.query.to));
    }
    return where;
  }

  function order(req, fallback = "created_at") {
    const sort = String(req.query.sort || fallback);
    const direction = String(req.query.order || "desc").toUpperCase() === "ASC" ? "ASC" : "DESC";
    return [[sort, direction]];
  }

  function shapeUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name || null,
      email: user.email,
      role: user.role || "student",
      companyId: user.company_id || null,
      createdAt: user.createdAt || null,
    };
  }

  function shapeCourse(course, extras = {}) {
    return {
      id: course.id,
      title: course.title,
      description: course.description || null,
      department: course.department || null,
      status: course.status,
      dueAt: course.due_at || null,
      activityCount: extras.activityCount || 0,
      completionRate: extras.completionRate || 0,
      createdAt: course.created_at,
      updatedAt: course.updated_at,
    };
  }

  function shapeActivity(activity, extras = {}) {
    return {
      id: activity.id,
      courseId: activity.course_id,
      title: activity.title,
      description: activity.description || null,
      status: activity.status,
      required: Boolean(activity.required),
      sortOrder: activity.sort_order || 0,
      checkoffCount: extras.checkoffCount || 0,
      createdAt: activity.created_at,
      updatedAt: activity.updated_at,
    };
  }

  function shapeCheckoff(checkoff) {
    return {
      id: checkoff.id,
      courseId: checkoff.course_id,
      activityId: checkoff.activity_id,
      employeeId: checkoff.employee_id,
      checkedByUserId: checkoff.checked_by_user_id,
      checkedAt: checkoff.checked_at,
      note: checkoff.note || null,
      employee: shapeUser(checkoff.employee),
      course: checkoff.OmsorgCourse
        ? { id: checkoff.OmsorgCourse.id, title: checkoff.OmsorgCourse.title, department: checkoff.OmsorgCourse.department || null }
        : null,
      activity: checkoff.OmsorgActivity ? { id: checkoff.OmsorgActivity.id, title: checkoff.OmsorgActivity.title } : null,
    };
  }

  function shapeComment(comment) {
    return {
      id: comment.id,
      courseId: comment.course_id || null,
      activityId: comment.activity_id || null,
      employeeId: comment.employee_id || null,
      authorUserId: comment.author_user_id,
      body: comment.body,
      createdAt: comment.created_at,
      employee: shapeUser(comment.employee),
      author: shapeUser(comment.author),
      course: comment.OmsorgCourse
        ? { id: comment.OmsorgCourse.id, title: comment.OmsorgCourse.title, department: comment.OmsorgCourse.department || null }
        : null,
      activity: comment.OmsorgActivity ? { id: comment.OmsorgActivity.id, title: comment.OmsorgActivity.title } : null,
    };
  }

  function shapeLog(log) {
    let metadata = {};
    try {
      metadata = log.metadata ? JSON.parse(log.metadata) : {};
    } catch {
      metadata = {};
    }
    return {
      id: log.id,
      actorUserId: log.actor_user_id || null,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id || null,
      ipAddress: log.ip_address || null,
      metadata,
      createdAt: log.created_at,
      actor: shapeUser(log.actor),
    };
  }

  function parseJsonArray(value) {
    try {
      const parsed = value ? JSON.parse(value) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function shapeHealthTool(tool) {
    return {
      id: tool.id,
      name: tool.name,
      category: tool.category,
      status: tool.status,
      baerumRelevant: Boolean(tool.baerum_relevant),
      digitalTilsynRelevant: Boolean(tool.digital_tilsyn_relevant),
      description: tool.description,
      integrationNotes: tool.integration_notes,
      sourceUrl: tool.source_url || undefined,
    };
  }

  function shapeDigitalSupervisionRoom(room) {
    return {
      id: room.id,
      roomName: room.room_name,
      department: room.department,
      status: room.status,
      lastEventAt: room.last_event_at || null,
      nextCheckAt: room.next_check_at || null,
      sensorTypes: parseJsonArray(room.sensor_types),
      openTasks: room.open_tasks || 0,
      notes: room.notes || "",
    };
  }

  function emptyDigitalSummary() {
    return { total: 0, ok: 0, oppmerksomhet: 0, kritisk: 0, offline: 0, openTasks: 0 };
  }

  function digitalSummaryFromRows(rows) {
    return rows.reduce((acc, room) => {
      acc.total += 1;
      acc.openTasks += room.open_tasks || 0;
      if (acc[room.status] !== undefined) acc[room.status] += 1;
      return acc;
    }, emptyDigitalSummary());
  }

  function shapeDeviation(deviation) {
    return {
      id: deviation.id,
      title: deviation.title,
      category: deviation.category,
      severity: deviation.severity,
      status: deviation.status,
      department: deviation.department,
      source: deviation.source,
      reportedAt: deviation.reported_at,
      dueAt: deviation.due_at,
      responsibleRole: deviation.responsible_role,
      relatedRoom: deviation.related_room || null,
      tiltak: deviation.tiltak,
    };
  }

  function emptyDeviationSummary() {
    return { total: 0, apen: 0, under_behandling: 0, lukket: 0, lav: 0, middels: 0, hoy: 0, kritisk: 0 };
  }

  function deviationSummaryFromRows(rows) {
    return rows.reduce((acc, deviation) => {
      acc.total += 1;
      if (acc[deviation.status] !== undefined) acc[deviation.status] += 1;
      if (acc[deviation.severity] !== undefined) acc[deviation.severity] += 1;
      return acc;
    }, emptyDeviationSummary());
  }

  function parseImplementationState(record) {
    if (!record?.state_json) return DEFAULT_IMPLEMENTATION_STATE;
    try {
      const parsed = JSON.parse(record.state_json);
      return { ...DEFAULT_IMPLEMENTATION_STATE, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    } catch {
      return DEFAULT_IMPLEMENTATION_STATE;
    }
  }

  function shapeImplementationState(record) {
    return {
      id: record.id,
      state: parseImplementationState(record),
      schemaVersion: record.schema_version,
      updatedByUserId: record.updated_by_user_id || null,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  async function getOrCreateImplementationState() {
    const [record] = await OmsorgImplementationState.findOrCreate({
      where: { id: "nordraaks-digitalt-tilsyn" },
      defaults: {
        id: "nordraaks-digitalt-tilsyn",
        state_json: JSON.stringify(DEFAULT_IMPLEMENTATION_STATE),
        schema_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    return record;
  }

  async function ensureDefaultHealthTools() {
    const count = await OmsorgHealthTool.count();
    if (count > 0) return;

    const now = new Date();
    await OmsorgHealthTool.bulkCreate(
      DEFAULT_HEALTH_TOOLS.map((tool) => ({
        id: tool.id,
        name: tool.name,
        category: tool.category,
        status: tool.status,
        baerum_relevant: Boolean(tool.baerumRelevant),
        digital_tilsyn_relevant: Boolean(tool.digitalTilsynRelevant),
        description: tool.description,
        integration_notes: tool.integrationNotes,
        source_url: tool.sourceUrl || null,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );
  }

  async function audit(req, action, entityType, entityId, metadata = {}) {
    await OmsorgAuditLog.create({
      actor_user_id: req.user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      ip_address: getIp(req),
      metadata: JSON.stringify(metadata),
    });
  }

  async function notifyProductFeedback(entry, req) {
    const webhookUrl = (process.env.FEEDBACK_NOTIFY_WEBHOOK_URL || "").trim();
    const slackUrl = (process.env.FEEDBACK_SLACK_WEBHOOK_URL || "").trim();
    const teamsUrl = (process.env.FEEDBACK_TEAMS_WEBHOOK_URL || "").trim();
    const notifyEmail = (process.env.FEEDBACK_NOTIFY_EMAIL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const payload = {
      type: "product_feedback",
      site: "Nordraaks vei sykehjem",
      category: String(entry.category || "annet"),
      preview: String(entry.body || "").slice(0, 500),
      authorName: entry.authorName ? String(entry.authorName) : null,
      authorEmail: entry.authorEmail ? String(entry.authorEmail) : null,
      adminUrl: "/admin/tilbakemelding",
      createdAt: entry.createdAt || new Date().toISOString(),
    };

    const attempts = [];

    if (slackUrl) {
      try {
        const response = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Ny tilbakemelding i OmsorgPilot (${payload.site})`,
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Ny tilbakemelding — OmsorgPilot" } },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*Kategori:*\n${payload.category}` },
                  { type: "mrkdwn", text: `*Fra:*\n${payload.authorName || payload.authorEmail || "Ukjent"}` },
                ],
              },
              { type: "section", text: { type: "mrkdwn", text: `*Melding:*\n${payload.preview}` } },
            ],
          }),
        });
        attempts.push({ channel: "slack", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "slack", sent: false, error: error.message });
      }
    }

    if (teamsUrl) {
      try {
        const response = await fetch(teamsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            summary: "Ny tilbakemelding i OmsorgPilot",
            themeColor: "0f766e",
            title: "OmsorgPilot — ny tilbakemelding",
            text: `**Kategori:** ${payload.category}\n\n**Fra:** ${payload.authorName || payload.authorEmail || "Ukjent"}\n\n${payload.preview}`,
          }),
        });
        attempts.push({ channel: "teams", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "teams", sent: false, error: error.message });
      }
    }

    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, notifyEmail: notifyEmail || null }),
        });
        attempts.push({ channel: "webhook", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "webhook", sent: false, error: error.message });
      }
    }

    if (notifyEmail && resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: (process.env.FEEDBACK_NOTIFY_FROM || "OmsorgPilot <onboarding@resend.dev>").trim(),
            to: notifyEmail.split(",").map((item) => item.trim()).filter(Boolean),
            subject: `[OmsorgPilot] Ny tilbakemelding: ${payload.category}`,
            text: `${payload.preview}\n\nFra: ${payload.authorName || payload.authorEmail || "Ukjent"}\nKategori: ${payload.category}\n\nÅpne adminpanelet for å lese mer.`,
          }),
        });
        attempts.push({ channel: "email", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "email", sent: false, error: error.message });
      }
    }

    const pushResult = await sendWebPushToLeaders({
      title: "Ny tilbakemelding i OmsorgPilot",
      body: `${payload.category}: ${payload.preview.slice(0, 120)}`,
      url: "/admin/tilbakemelding",
    });
    if (pushResult.sent > 0) attempts.push({ channel: "web_push", sent: true, count: pushResult.sent });

    const ticketResult = await forwardFeedbackToTicketSystems(entry);
    if (ticketResult.attempted) {
      attempts.push(...(ticketResult.channels || []));
    }

    if (attempts.length === 0) {
      return { attempted: false, sent: false, reason: "not_configured" };
    }

    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  async function forwardFeedbackToTicketSystems(entry) {
    const jiraUrl = (process.env.FEEDBACK_JIRA_WEBHOOK_URL || "").trim();
    const serviceNowUrl = (process.env.FEEDBACK_SERVICENOW_WEBHOOK_URL || "").trim();
    const payload = {
      source: "OmsorgPilot",
      id: String(entry.id || ""),
      category: String(entry.category || "annet"),
      summary: `[OmsorgPilot] ${String(entry.category || "tilbakemelding")}`,
      description: String(entry.body || ""),
      authorName: entry.authorName ? String(entry.authorName) : null,
      authorEmail: entry.authorEmail ? String(entry.authorEmail) : null,
      createdAt: entry.createdAt || new Date().toISOString(),
      adminUrl: "/admin/tilbakemelding",
    };
    const attempts = [];

    if (jiraUrl) {
      try {
        const response = await fetch(jiraUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, target: "jira" }),
        });
        attempts.push({ channel: "jira", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "jira", sent: false, error: error.message });
      }
    }

    if (serviceNowUrl) {
      try {
        const response = await fetch(serviceNowUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, target: "servicenow" }),
        });
        attempts.push({ channel: "servicenow", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "servicenow", sent: false, error: error.message });
      }
    }

    if (!attempts.length) {
      return { attempted: false, sent: false, reason: "not_configured", channels: attempts };
    }

    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  async function notifyWeeklyReportDraft(draft, req) {
    const notifyEmail = (process.env.WEEKLY_REPORT_NOTIFY_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL || "").trim();
    const slackUrl = (process.env.WEEKLY_REPORT_SLACK_WEBHOOK_URL || process.env.FEEDBACK_SLACK_WEBHOOK_URL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const deptLabel = draft.department ? ` · ${draft.department}` : "";
    const fullBody = String(draft.body || "");
    const preview = fullBody.slice(0, 2000);
    const attachmentName = `ukesrapport-utkast-${(draft.generatedAt || new Date().toISOString()).slice(0, 10)}.txt`;
    const pdfName = `ukesrapport-utkast-${(draft.generatedAt || new Date().toISOString()).slice(0, 10)}.pdf`;
    const attachmentContent = Buffer.from(fullBody, "utf-8").toString("base64");
    const pdfContent = buildSimplePdf(fullBody).toString("base64");
    const attempts = [];

    if (slackUrl) {
      try {
        const response = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Ukesrapport-utkast klar — Nordraaks vei sykehjem${deptLabel}`,
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Ukesrapport-utkast — OmsorgPilot" } },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*Periode:*\n${draft.period || "uke"}` },
                  { type: "mrkdwn", text: `*Generert:*\n${draft.generatedAt || new Date().toISOString()}` },
                ],
              },
              { type: "section", text: { type: "mrkdwn", text: preview.slice(0, 2800) } },
              { type: "context", elements: [{ type: "mrkdwn", text: "Åpne /admin/rapporter for full tekst og PDF." }] },
            ],
          }),
        });
        attempts.push({ channel: "slack", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "slack", sent: false, error: error.message });
      }
    }

    if (notifyEmail && resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: (process.env.WEEKLY_REPORT_NOTIFY_FROM || process.env.FEEDBACK_NOTIFY_FROM || "OmsorgPilot <onboarding@resend.dev>").trim(),
            to: notifyEmail.split(",").map((item) => item.trim()).filter(Boolean),
            subject: `[OmsorgPilot] Ukesrapport-utkast${deptLabel}`,
            text: `${preview}\n\n---\nGenerert: ${draft.generatedAt || new Date().toISOString()}\nPeriode: ${draft.period || "uke"}${deptLabel}\n\nVedlegg: .txt og .pdf (forenklet). Full PDF via Skriv ut i /admin/rapporter.`,
            attachments: fullBody
              ? [
                  { filename: attachmentName, content: attachmentContent },
                  { filename: pdfName, content: pdfContent },
                ]
              : undefined,
          }),
        });
        attempts.push({ channel: "email", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "email", sent: false, error: error.message });
      }
    }

    const pushResult = await sendWebPushToLeaders({
      title: "Ukesrapport-utkast er klart",
      body: `Periode: ${draft.period || "uke"}${deptLabel}`,
      url: "/admin/rapporter",
    });
    if (pushResult.sent > 0) attempts.push({ channel: "web_push", sent: true, count: pushResult.sent });

    if (attempts.length === 0) {
      return { attempted: false, sent: false, reason: "not_configured" };
    }

    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  const CRITICAL_DEVIATION_SEVERITIES = new Set(["hoy", "kritisk"]);

  function isCriticalOpenDeviation(deviation) {
    return CRITICAL_DEVIATION_SEVERITIES.has(deviation.severity) && ["apen", "under_behandling"].includes(deviation.status);
  }

  function escapePdfText(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }

  function buildSimplePdf(text) {
    const normalized = String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
    const lines = normalized.split(/\r?\n/).slice(0, 55);
    let stream = "BT /F1 10 Tf\n";
    let y = 780;
    for (const line of lines) {
      stream += `1 0 0 1 40 ${y} Tm (${escapePdfText(line.slice(0, 95))}) Tj\n`;
      y -= 13;
      if (y < 40) break;
    }
    stream += "ET";
    const streamBytes = Buffer.byteLength(stream, "latin1");
    const header = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${streamBytes} >>stream
${stream}endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000114 00000 n 
0000000240 00000 n 
0000000350 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
430
%%EOF`;
    return Buffer.from(header, "latin1");
  }

  async function notifyCriticalDeviation(deviation, req) {
    const notifyEmail = (process.env.DEVIATION_CRITICAL_NOTIFY_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL || "").trim();
    const slackUrl = (process.env.DEVIATION_CRITICAL_SLACK_WEBHOOK_URL || process.env.FEEDBACK_SLACK_WEBHOOK_URL || "").trim();
    const teamsUrl = (process.env.DEVIATION_CRITICAL_TEAMS_WEBHOOK_URL || process.env.FEEDBACK_TEAMS_WEBHOOK_URL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const payload = {
      type: "critical_deviation",
      site: "Nordraaks vei sykehjem",
      title: String(deviation.title || "Avvik"),
      severity: String(deviation.severity || "kritisk"),
      department: String(deviation.department || "Ukjent"),
      status: String(deviation.status || "apen"),
      tiltak: String(deviation.tiltak || "").slice(0, 500),
      adminUrl: "/admin/avvik",
      id: deviation.id,
    };
    const attempts = [];

    if (slackUrl) {
      try {
        const response = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Kritisk avvik — ${payload.title}`,
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Kritisk avvik — OmsorgPilot" } },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*Alvorlighet:*\n${payload.severity}` },
                  { type: "mrkdwn", text: `*Avdeling:*\n${payload.department}` },
                ],
              },
              { type: "section", text: { type: "mrkdwn", text: `*${payload.title}*\n${payload.tiltak}` } },
            ],
          }),
        });
        attempts.push({ channel: "slack", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "slack", sent: false, error: error.message });
      }
    }

    if (teamsUrl) {
      try {
        const response = await fetch(teamsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            summary: "Kritisk avvik i OmsorgPilot",
            themeColor: "DC2626",
            title: "OmsorgPilot — kritisk avvik",
            text: `**${payload.title}**\n\nAlvorlighet: ${payload.severity}\nAvdeling: ${payload.department}\n\n${payload.tiltak}`,
          }),
        });
        attempts.push({ channel: "teams", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "teams", sent: false, error: error.message });
      }
    }

    if (notifyEmail && resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: (process.env.DEVIATION_CRITICAL_NOTIFY_FROM || process.env.FEEDBACK_NOTIFY_FROM || "OmsorgPilot <onboarding@resend.dev>").trim(),
            to: notifyEmail.split(",").map((item) => item.trim()).filter(Boolean),
            subject: `[OmsorgPilot] Kritisk avvik: ${payload.title}`,
            text: `${payload.title}\nAlvorlighet: ${payload.severity}\nAvdeling: ${payload.department}\nStatus: ${payload.status}\n\nTiltak:\n${payload.tiltak}\n\nÅpne /admin/avvik for oppfølging.`,
          }),
        });
        attempts.push({ channel: "email", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "email", sent: false, error: error.message });
      }
    }

    const smsResult = await notifyDeviationSms({
      severity: payload.severity,
      status: payload.status || "apen",
      title: payload.title,
      department: payload.department,
    });
    if (smsResult.sent) attempts.push({ channel: "sms", sent: true });

    const pushResult = await sendWebPushToLeaders({
      title: `Kritisk avvik: ${payload.title}`,
      body: `${payload.department} · ${payload.severity}`,
      url: "/admin/avvik",
    });
    if (pushResult.sent > 0) attempts.push({ channel: "web_push", sent: true, count: pushResult.sent });

    if (attempts.length === 0) {
      return { attempted: false, sent: false, reason: "not_configured" };
    }

    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  function configureWebPush() {
    const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
    const subject = (process.env.VAPID_SUBJECT || "mailto:admin@baerum.kommune.no").trim();
    if (!webpush || !publicKey || !privateKey) return false;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  }

  async function sendWebPushToLeaders(payload) {
    if (!configureWebPush()) return { attempted: false, sent: 0 };
    const leaders = await User.findAll({ where: { role: { [Op.in]: ADMIN_ROLES } }, attributes: ["id"] });
    const leaderIds = leaders.map((user) => user.id);
    if (!leaderIds.length) return { attempted: true, sent: 0 };

    const subs = await OmsorgPushSubscription.findAll({ where: { user_id: { [Op.in]: leaderIds } } });
    const body = JSON.stringify({
      title: payload.title || "OmsorgPilot",
      body: payload.body || "",
      url: payload.url || "/admin",
    });
    let sent = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(JSON.parse(sub.subscription_json), body);
        sent += 1;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await sub.destroy();
        }
      }
    }

    return { attempted: true, sent };
  }

  async function sendDeviationSms(message, toEnvKey = "DEVIATION_CRITICAL_SMS_TO") {
    const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
    const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
    const from = (process.env.TWILIO_FROM_NUMBER || "").trim();
    const to = (process.env[toEnvKey] || "").trim();
    if (!sid || !token || !from || !to) return { sent: false, reason: "not_configured" };

    try {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const params = new URLSearchParams({ To: to, From: from, Body: String(message || "").slice(0, 1600) });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      return { sent: response.ok, status: response.status };
    } catch (error) {
      return { sent: false, error: error.message };
    }
  }

  async function sendCriticalDeviationSms(message) {
    return sendDeviationSms(message, "DEVIATION_CRITICAL_SMS_TO");
  }

  async function sendMediumDeviationSms(message) {
    return sendDeviationSms(message, "DEVIATION_MEDIUM_SMS_TO");
  }

  async function notifyDeviationSms(deviation) {
    if (!["apen", "under_behandling"].includes(deviation.status)) {
      return { sent: false, reason: "closed" };
    }
    const message = `OmsorgPilot avvik (${deviation.severity}): ${deviation.title} (${deviation.department})`;
    const allEnabled = (process.env.DEVIATION_ALL_SMS_ENABLED || "").trim() === "true";
    if (allEnabled) {
      return sendDeviationSms(message, "DEVIATION_ALL_SMS_TO");
    }
    if (CRITICAL_DEVIATION_SEVERITIES.has(deviation.severity)) {
      return sendCriticalDeviationSms(message);
    }
    if (deviation.severity === "middels") {
      return sendMediumDeviationSms(message);
    }
    return { sent: false, reason: "not_configured" };
  }

  function isMediumOpenDeviation(deviation) {
    return deviation.severity === "middels" && ["apen", "under_behandling"].includes(deviation.status);
  }

  async function notifyMediumDeviation(deviation, req) {
    const smsResult = await notifyDeviationSms(deviation);
    if (!smsResult.sent) return { attempted: Boolean(process.env.DEVIATION_MEDIUM_SMS_TO), sent: false, reason: smsResult.reason || "not_configured" };
    await audit(req, "deviation.medium_sms_sent", "deviation", String(deviation.id), { severity: deviation.severity });
    return { attempted: true, sent: true, channels: [{ channel: "sms", sent: true }] };
  }

  function getWeekStart(date, weeksAgo = 0) {
    const d = new Date(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - weeksAgo * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async function buildWeeklyTrend(department = "", weeks = 6) {
    const now = new Date();
    let activityTotal;

    if (department) {
      const coursesInDept = await OmsorgCourse.findAll({ where: { department }, attributes: ["id"] });
      const courseIds = coursesInDept.map((course) => course.id);
      activityTotal = courseIds.length ? await OmsorgActivity.count({ where: { course_id: { [Op.in]: courseIds } } }) : 0;
    } else {
      activityTotal = await OmsorgActivity.count();
    }

    const trend = [];

    for (let i = weeks - 1; i >= 0; i -= 1) {
      const weekStart = getWeekStart(now, i);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const dateWhere = (field) => ({ [field]: { [Op.gte]: weekStart, [Op.lt]: weekEnd } });
      const courseInclude = department
        ? { model: OmsorgCourse, where: { department }, required: true, attributes: [] }
        : null;

      const checkoffQuery = { where: dateWhere("checked_at") };
      const commentQuery = { where: dateWhere("created_at") };
      if (courseInclude) {
        checkoffQuery.include = [courseInclude];
        checkoffQuery.distinct = true;
        commentQuery.include = [courseInclude];
        commentQuery.distinct = true;
      }

      const [checkoffs, comments] = await Promise.all([
        OmsorgCheckoff.count(checkoffQuery),
        OmsorgComment.count(commentQuery),
      ]);
      const completionRate = activityTotal > 0 ? Math.min(100, Math.round((checkoffs / activityTotal) * 100)) : 0;

      trend.push({
        weekStart: weekStart.toISOString(),
        label: weekStart.toLocaleDateString("nb-NO", { day: "2-digit", month: "short" }),
        checkoffs,
        comments,
        completionRate,
      });
    }

    return trend;
  }

  async function buildQuarterlyTrend(department = "", quarters = 4) {
    const now = new Date();
    let activityTotal;

    if (department) {
      const coursesInDept = await OmsorgCourse.findAll({ where: { department }, attributes: ["id"] });
      const courseIds = coursesInDept.map((course) => course.id);
      activityTotal = courseIds.length ? await OmsorgActivity.count({ where: { course_id: { [Op.in]: courseIds } } }) : 0;
    } else {
      activityTotal = await OmsorgActivity.count();
    }

    const trend = [];

    for (let i = quarters - 1; i >= 0; i -= 1) {
      const ref = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
      const quarterStart = new Date(ref.getFullYear(), Math.floor(ref.getMonth() / 3) * 3, 1);
      const quarterEnd = new Date(quarterStart);
      quarterEnd.setMonth(quarterStart.getMonth() + 3);

      const dateWhere = (field) => ({ [field]: { [Op.gte]: quarterStart, [Op.lt]: quarterEnd } });
      const courseInclude = department
        ? { model: OmsorgCourse, where: { department }, required: true, attributes: [] }
        : null;

      const checkoffQuery = { where: dateWhere("checked_at") };
      const commentQuery = { where: dateWhere("created_at") };
      if (courseInclude) {
        checkoffQuery.include = [courseInclude];
        checkoffQuery.distinct = true;
        commentQuery.include = [courseInclude];
        commentQuery.distinct = true;
      }

      const [checkoffs, comments] = await Promise.all([
        OmsorgCheckoff.count(checkoffQuery),
        OmsorgComment.count(commentQuery),
      ]);
      const completionRate = activityTotal > 0 ? Math.min(100, Math.round((checkoffs / activityTotal) * 100)) : 0;
      const qNum = Math.floor(quarterStart.getMonth() / 3) + 1;

      trend.push({
        quarterStart: quarterStart.toISOString(),
        label: `Q${qNum} ${quarterStart.getFullYear()}`,
        checkoffs,
        comments,
        completionRate,
        goalMet: completionRate >= 80,
      });
    }

    return trend;
  }

  function buildYearOverYearComparison(quarterlyTrendFull) {
    if (!Array.isArray(quarterlyTrendFull) || quarterlyTrendFull.length < 2) return null;

    const current = quarterlyTrendFull[quarterlyTrendFull.length - 1];
    const currentDate = new Date(current.quarterStart);
    const targetYear = currentDate.getFullYear() - 1;
    const targetQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
    const previous = quarterlyTrendFull.find((quarter) => {
      const date = new Date(quarter.quarterStart);
      return date.getFullYear() === targetYear && Math.floor(date.getMonth() / 3) + 1 === targetQuarter;
    });

    if (!previous) return null;

    return {
      currentLabel: current.label,
      previousLabel: previous.label,
      currentRate: current.completionRate,
      previousRate: previous.completionRate,
      delta: current.completionRate - previous.completionRate,
      goalMet: current.goalMet,
    };
  }

  async function buildDepartmentStats(departments) {
    if (!departments.length) return [];

    const stats = await Promise.all(
      departments.map(async (department) => {
        const courseInclude = { model: OmsorgCourse, where: { department }, required: true, attributes: [] };
        const coursesInDept = await OmsorgCourse.findAll({ where: { department }, attributes: ["id"] });
        const courseIds = coursesInDept.map((course) => course.id);
        const [checkoffs, comments, activities] = await Promise.all([
          OmsorgCheckoff.count({ include: [courseInclude], distinct: true }),
          OmsorgComment.count({ include: [courseInclude], distinct: true }),
          courseIds.length ? OmsorgActivity.count({ where: { course_id: { [Op.in]: courseIds } } }) : 0,
        ]);
        const completionRate = activities > 0 ? Math.round((checkoffs / activities) * 100) : 0;
        return { department, checkoffs, comments, activities, completionRate };
      }),
    );

    return stats.sort((a, b) => a.department.localeCompare(b.department, "nb"));
  }

  function stripAssistantMetadata(text) {
    return String(text || "")
      .replace(/\s*AI[\s-–—‑]*kilde\s*:\s*[^\n]*/gi, "")
      .replace(/\s*Kilde\s*:\s*local-openai[^\n]*/gi, "")
      .replace(/\s*Source\s*:\s*[^\n]*/gi, "")
      .replace(/\blocal-openai\b/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function formatProseSegment(text) {
    return String(text || "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/^\*\s+/gm, "• ")
      .replace(/\n{3,}/g, "\n\n");
  }

  function formatCareAssistantAnswer(text) {
    const cleaned = stripAssistantMetadata(text);
    if (!cleaned) return "";

    const parts = [];
    const fenceRegex = /```(\w*)\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = fenceRegex.exec(cleaned)) !== null) {
      if (match.index > lastIndex) {
        parts.push(formatProseSegment(cleaned.slice(lastIndex, match.index)));
      }

      const language = match[1] || "";
      const code = match[2].replace(/\n$/, "");
      parts.push(`\`\`\`${language}\n${code}\n\`\`\``);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < cleaned.length) {
      parts.push(formatProseSegment(cleaned.slice(lastIndex)));
    }

    return parts.join("").trim();
  }

  function finalizeCareAssistantAnswer(text) {
    return stripAssistantMetadata(formatCareAssistantAnswer(text));
  }

  function careAssistantSystemPrompt() {
    const idealsText = PLATFORM_IDEALS.map((ideal) => `${ideal.title}: ${ideal.description}`).join(" ");
    return [
      "Du er Care Assistenten i Nordraaks OmsorgPlattform (OmsorgPilot) for Bærum kommune, Helse og omsorg, Nordraaks vei sykehjem.",
      "Svar alltid på norsk med rolig, profesjonell og hjelpsom tone – som en dyktig kollega i helsevesenet.",
      "Skriv klart, presist og naturlig. Bruk korte avsnitt, enkle overskrifter på egen linje uten # eller **, og nummererte punkter (1. 2. 3.) når det passer.",
      "For rapporter, avvik, prosedyrer og fagtekst: ren tekst uten markdown-headere eller fet skrift.",
      "Når brukeren ber om kode, SQL, scripts, konfigurasjon eller tekniske eksempler: bruk vanlige markdown-kodeblokker med ``` språk og avsluttende ``` – som i ChatGPT.",
      "Du hjelper superbruker, ledere og ansatte med digitalt tilsyn, RoomMate, Sensio Care, Sensio 365, kurs, sjekklister, avvik, rapporter, opplæring, personvern, nattevakt og implementering.",
      "Du kan lage utkast til ukesrapporter, avdelingsrapporter, tiltakslister, sjekklister, opplæringsplaner og lederoppsummeringer.",
      "I rapporter: start med kort innledning, deretter tydelige avsnitt (Opplæring, Fasefremdrift, Avvik, Tekniske saker, Tiltak neste uke, Konklusjon) uten markdown-headere.",
      "Avslutt med kort, naturlig konklusjon. Skriv aldri AI-kilde, modellnavn, teknisk metadata eller kildehenvisninger i svaret.",
      "Du skal ikke late som du er helsepersonell, lege, sykepleier eller juridisk rådgiver.",
      "Ikke be om pasientidentifiserbare opplysninger. Hvis brukeren skriver sensitive opplysninger, svar generelt og be dem bruke godkjent journalsystem/lokale rutiner.",
      "Ved akutt fare, pasientsikkerhet, medisinske spørsmål eller usikkerhet skal du be brukeren følge lokale rutiner og kontakte ansvarlig helsepersonell eller leder.",
      `Plattformens grunnholdning: ${PLATFORM_MISSION_QUOTE}`,
      `Følg alltid disse felles prinsippene: ${idealsText}`,
    ].join(" ");
  }

  function buildCareMessages(question, context, history = []) {
    const safeHistory = Array.isArray(history)
      ? history
          .filter((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
          .slice(-10)
          .map((message) => ({ role: message.role, content: message.content.slice(0, 4000) }))
      : [];

    return [
      { role: "system", content: careAssistantSystemPrompt() },
      ...safeHistory,
      {
        role: "user",
        content: context ? `Kontekst:\n${context}\n\nSpørsmål:\n${question}` : question,
      },
    ];
  }

  async function callExternalCareAssistant(messages) {
    const candidates = [
      process.env.ZENTRO_PRI_CHAT_URL,
      process.env.OMSORGPILOT_AI_CHAT_URL,
      "https://robot.zentro.run/api/public/chat",
      "https://api.zentro.run/api/public/chat",
    ].filter(Boolean);
    const apiKey = (process.env.SH_API_KEY || process.env.OMSORGPILOT_AI_API_KEY || "").trim();

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "x-sh-api-key": apiKey } : {}),
          },
          body: JSON.stringify({ messages }),
        });

        if (!response.ok) continue;
        const body = await response.json();
        const answer = body.reply || body.answer || body.message;
        if (answer) return { answer, source: url };
      } catch {
        // Try the next configured AI backend.
      }
    }

    return null;
  }

  function zentroPriConfig() {
    return {
      priUrl: (process.env.ZENTRO_PRI_URL || "https://pri.zentro.run").replace(/\/+$/, ""),
      chatUrl: (process.env.ZENTRO_PRI_CHAT_URL || process.env.OMSORGPILOT_AI_CHAT_URL || "").replace(/\/+$/, ""),
      twinUrl: (process.env.ZENTRO_PRI_TWIN_URL || "").replace(/\/+$/, ""),
    };
  }

  async function probeService(url, method = "HEAD") {
    if (!url) return { configured: false, reachable: false };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(url, { method, signal: controller.signal });
      clearTimeout(timeout);
      return { configured: true, reachable: response.ok || response.status < 500 };
    } catch {
      return { configured: true, reachable: false };
    }
  }

  router.get("/site-overview", async (_req, res) => {
    try {
      const [employees, courses, activities, checkoffs, courseRows] = await Promise.all([
        User.count(),
        OmsorgCourse.count(),
        OmsorgActivity.count(),
        OmsorgCheckoff.count(),
        OmsorgCourse.findAll({ attributes: ["department"], raw: true }),
      ]);
      const departments = [...new Set(courseRows.map((row) => String(row.department || "").trim()).filter(Boolean))];
      const activeDepartments = departments.length;
      const completionRate = activities > 0 ? Math.min(100, Math.round((checkoffs / activities) * 100)) : 0;
      const phaseLabel =
        activeDepartments >= 9 ? "Fase 3" : activeDepartments >= 6 ? "Fase 2" : activeDepartments >= 3 ? "Fase 1" : "Oppstart";

      res.json({
        site: "Nordraaks vei sykehjem",
        org: "Bærum kommune · Helse og omsorg",
        productName: "Nordraaks OmsorgPlattform",
        employees,
        courses,
        activities,
        checkoffs,
        completionRate,
        activeDepartments,
        totalDepartments: 9,
        trainingGoalPercent: 90,
        phaseLabel,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Kunne ikke hente oversikt", details: error.message });
    }
  });

  router.use((req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: "Mangler brukerrolle" });
    if (!ADMIN_ROLES.includes(role)) return res.status(403).json({ error: "Ingen tilgang" });
    next();
  });

  router.get("/dashboard", async (_req, res) => {
    const [employees, courses, activities, checkoffs, comments, logs] = await Promise.all([
      User.count(),
      OmsorgCourse.count(),
      OmsorgActivity.count(),
      OmsorgCheckoff.count(),
      OmsorgComment.count(),
      OmsorgAuditLog.count(),
    ]);

    const completionRate = activities > 0 ? Math.round((checkoffs / activities) * 100) : 0;
    res.json({ employees, courses, activities, checkoffs, comments, logs, completionRate });
  });

  router.get("/platform-meta", async (_req, res) => {
    const openai = _req.app.get("openai");

    res.json({
      productName: "Nordraaks OmsorgPlattform",
      poweredBy: "OmsorgPilot",
      org: "Bærum kommune · Helse og omsorg",
      site: "Nordraaks vei sykehjem",
      version: "3.8.0",
      mission: {
        headline: "Profesjonell digital arbeidsflate for helse og omsorg",
        quote: PLATFORM_MISSION_QUOTE,
        source: "OmsorgPilot",
      },
      ideals: PLATFORM_IDEALS,
      senseReasonAct: [
        { step: "Sense", label: "Oppfange", modules: ["digitalt-tilsyn", "aktivitet", "avvik", "kurs"] },
        { step: "Reason", label: "Vurdere", modules: ["care-assistenten", "implementering-scenario"] },
        { step: "Act", label: "Handle", modules: ["rapporter", "implementering", "logs"] },
      ],
      services: {
        database: { configured: true, reachable: true },
        openai: { configured: Boolean(openai), reachable: Boolean(openai) },
      },
    });
  });

  router.post("/twin-scenario", async (req, res) => {
    const twinUrl = zentroPriConfig().twinUrl;
    const scenario = String(req.body?.scenario || req.body?.name || "").trim();
    const department = String(req.body?.department || "2. etasje").trim();

    if (!twinUrl) {
      return res.status(501).json({
        ok: false,
        stub: true,
        message:
          "Zentro PRI twin-scenario er ikke koblet ennå. Sett ZENTRO_PRI_TWIN_URL når API-dokumentasjon er bekreftet.",
        scenario: scenario || "pilot-stress-test",
        department,
        recommendation:
          "Fortsett med fasevis utrulling i implementeringsmodulen til twin-API er tilgjengelig.",
      });
    }

    try {
      const response = await fetch(twinUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, department, source: "omsorgpilot" }),
      });
      if (!response.ok) {
        return res.status(502).json({ ok: false, error: "Twin-tjenesten svarte med feil", status: response.status });
      }
      const body = await response.json();
      await audit(req, "twin_scenario.requested", "twin_scenario", null, { scenario, department });
      return res.json({ ok: true, ...body });
    } catch (error) {
      return res.status(502).json({ ok: false, error: "Kunne ikke nå twin-tjenesten", details: error.message });
    }
  });

  router.post("/care-assistenten", async (req, res) => {
    const openai = req.app.get("openai");
    const model = req.app.get("openai_model") || "gpt-4o-mini";
    const question = String(req.body?.question || "").trim();
    const context = String(req.body?.context || "").trim();
    const history = Array.isArray(req.body?.messages) ? req.body.messages : [];

    if (!question) return res.status(400).json({ error: "Skriv et spørsmål til Care Assistenten" });
    const messages = buildCareMessages(question, context, history);

    if (!openai) {
      const external = await callExternalCareAssistant(messages);
      if (!external) return res.status(500).json({ error: "AI-tjenesten er ikke konfigurert på serveren" });
      await audit(req, "care_assistant.asked", "care_assistant", null, { question: question.slice(0, 500), source: external.source });
      return res.json({ ok: true, answer: finalizeCareAssistantAnswer(external.answer) });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
    });

    const answer = finalizeCareAssistantAnswer(
      completion.choices?.[0]?.message?.content || "Jeg klarte ikke å lage et svar akkurat nå.",
    );
    await audit(req, "care_assistant.asked", "care_assistant", null, { question: question.slice(0, 500) });
    res.json({ ok: true, answer });
  });

  router.get("/helseverktoy", async (req, res) => {
    await ensureDefaultHealthTools();
    const category = String(req.query.category || "").trim();
    const baerumOnly = String(req.query.baerum || "").trim() === "1";
    const digitaltTilsynOnly = String(req.query.digitaltTilsyn || "").trim() === "1";
    const where = {};

    if (category) where.category = category;
    if (baerumOnly) where.baerum_relevant = true;
    if (digitaltTilsynOnly) where.digital_tilsyn_relevant = true;

    const tools = await OmsorgHealthTool.findAll({ where, order: [["category", "ASC"], ["name", "ASC"]] });
    res.json({ data: tools.filter((tool) => tool.id !== "gerica-lifecare").map(shapeHealthTool) });
  });

  router.post("/helseverktoy", async (req, res) => {
    const now = new Date();
    const id = String(req.body?.id || "").trim();
    const name = String(req.body?.name || "").trim();
    if (!id || !name) return res.status(400).json({ error: "ID og navn er påkrevd" });

    const tool = await OmsorgHealthTool.create({
      id,
      name,
      category: String(req.body?.category || "kommune").trim(),
      status: String(req.body?.status || "planlagt").trim(),
      baerum_relevant: Boolean(req.body?.baerumRelevant),
      digital_tilsyn_relevant: Boolean(req.body?.digitalTilsynRelevant),
      description: String(req.body?.description || "").trim(),
      integration_notes: String(req.body?.integrationNotes || "").trim(),
      source_url: req.body?.sourceUrl ? String(req.body.sourceUrl).trim() : null,
      created_at: now,
      updated_at: now,
    });

    await audit(req, "health_tool.created", "health_tool", tool.id, { name: tool.name });
    res.status(201).json(shapeHealthTool(tool));
  });

  router.get("/digitalt-tilsyn", async (req, res) => {
    const status = String(req.query.status || "").trim();
    const department = String(req.query.department || "").trim();
    const where = {};

    if (status) where.status = status;
    if (department) where.department = department;

    const [rooms, allRooms] = await Promise.all([
      OmsorgDigitalSupervisionRoom.findAll({ where, order: [["department", "ASC"], ["room_name", "ASC"]] }),
      OmsorgDigitalSupervisionRoom.findAll(),
    ]);

    res.json({
      summary: digitalSummaryFromRows(allRooms),
      departments: [...new Set(allRooms.map((room) => room.department))],
      data: rooms.map(shapeDigitalSupervisionRoom),
    });
  });

  router.post("/digitalt-tilsyn", async (req, res) => {
    const now = new Date();
    const id = String(req.body?.id || "").trim();
    if (!id) return res.status(400).json({ error: "Rom-ID er påkrevd" });

    const room = await OmsorgDigitalSupervisionRoom.create({
      id,
      room_name: String(req.body?.roomName || "").trim(),
      department: String(req.body?.department || "").trim(),
      status: String(req.body?.status || "ok").trim(),
      last_event_at: req.body?.lastEventAt ? new Date(req.body.lastEventAt) : null,
      next_check_at: req.body?.nextCheckAt ? new Date(req.body.nextCheckAt) : null,
      sensor_types: JSON.stringify(Array.isArray(req.body?.sensorTypes) ? req.body.sensorTypes : []),
      open_tasks: Number(req.body?.openTasks || 0),
      notes: req.body?.notes ? String(req.body.notes).trim() : null,
      created_at: now,
      updated_at: now,
    });

    await audit(req, "digital_supervision.created", "digital_supervision_room", room.id, { status: room.status });
    res.status(201).json(shapeDigitalSupervisionRoom(room));
  });

  router.patch("/digitalt-tilsyn/:id", async (req, res) => {
    const room = await OmsorgDigitalSupervisionRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ error: "Tilsynsrom ikke funnet" });

    await room.update({
      room_name: req.body?.roomName !== undefined ? String(req.body.roomName).trim() : room.room_name,
      department: req.body?.department !== undefined ? String(req.body.department).trim() : room.department,
      status: req.body?.status !== undefined ? String(req.body.status).trim() : room.status,
      last_event_at: req.body?.lastEventAt !== undefined ? (req.body.lastEventAt ? new Date(req.body.lastEventAt) : null) : room.last_event_at,
      next_check_at: req.body?.nextCheckAt !== undefined ? (req.body.nextCheckAt ? new Date(req.body.nextCheckAt) : null) : room.next_check_at,
      sensor_types: req.body?.sensorTypes !== undefined ? JSON.stringify(Array.isArray(req.body.sensorTypes) ? req.body.sensorTypes : []) : room.sensor_types,
      open_tasks: req.body?.openTasks !== undefined ? Number(req.body.openTasks) : room.open_tasks,
      notes: req.body?.notes !== undefined ? String(req.body.notes || "").trim() || null : room.notes,
      updated_at: new Date(),
    });

    await audit(req, "digital_supervision.updated", "digital_supervision_room", room.id, { status: room.status });
    res.json(shapeDigitalSupervisionRoom(room));
  });

  router.get("/avvik", async (req, res) => {
    const status = String(req.query.status || "").trim();
    const severity = String(req.query.severity || "").trim();
    const q = String(req.query.q || "").trim().toLowerCase();
    const where = {};

    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (q) {
      const like = `%${q}%`;
      where[Op.or] = [
        { title: { [Op.like]: like } },
        { category: { [Op.like]: like } },
        { department: { [Op.like]: like } },
        { source: { [Op.like]: like } },
        { responsible_role: { [Op.like]: like } },
        { tiltak: { [Op.like]: like } },
      ];
    }

    const [deviations, allDeviations] = await Promise.all([
      OmsorgDeviation.findAll({ where, order: [["reported_at", "DESC"]] }),
      OmsorgDeviation.findAll(),
    ]);

    res.json({ summary: deviationSummaryFromRows(allDeviations), data: deviations.map(shapeDeviation) });
  });

  router.post("/avvik", async (req, res) => {
    const now = new Date();
    const id = String(req.body?.id || `avvik-${Date.now()}`).trim();
    const title = String(req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "Tittel er påkrevd" });

    const deviation = await OmsorgDeviation.create({
      id,
      title,
      category: String(req.body?.category || "Drift").trim(),
      severity: String(req.body?.severity || "middels").trim(),
      status: String(req.body?.status || "apen").trim(),
      department: String(req.body?.department || "Ukjent avdeling").trim(),
      source: String(req.body?.source || "OmsorgPilot").trim(),
      reported_at: req.body?.reportedAt ? new Date(req.body.reportedAt) : now,
      due_at: req.body?.dueAt ? new Date(req.body.dueAt) : null,
      responsible_role: String(req.body?.responsibleRole || "Leder").trim(),
      related_room: req.body?.relatedRoom ? String(req.body.relatedRoom).trim() : null,
      tiltak: String(req.body?.tiltak || "Tiltak må vurderes av ansvarlig rolle.").trim(),
      created_at: now,
      updated_at: now,
    });

    await audit(req, "deviation.created", "deviation", deviation.id, { severity: deviation.severity, status: deviation.status });

    if (isCriticalOpenDeviation(deviation)) {
      const notifyResult = await notifyCriticalDeviation(deviation, req);
      await audit(req, notifyResult.sent ? "deviation.critical_notified" : "deviation.critical_notify_failed", "deviation", deviation.id, {
        sent: notifyResult.sent,
        reason: notifyResult.reason || null,
      });
    } else if (isMediumOpenDeviation(deviation)) {
      const notifyResult = await notifyMediumDeviation(deviation, req);
      if (notifyResult.attempted) {
        await audit(req, notifyResult.sent ? "deviation.medium_notified" : "deviation.medium_notify_failed", "deviation", deviation.id, {
          sent: notifyResult.sent,
          reason: notifyResult.reason || null,
        });
      }
    } else if ((process.env.DEVIATION_ALL_SMS_ENABLED || "").trim() === "true" && ["apen", "under_behandling"].includes(deviation.status)) {
      const smsResult = await notifyDeviationSms(deviation);
      if (smsResult.sent) {
        await audit(req, "deviation.all_sms_sent", "deviation", deviation.id, { severity: deviation.severity });
      }
    }

    res.status(201).json(shapeDeviation(deviation));
  });

  router.patch("/avvik/:id", async (req, res) => {
    const deviation = await OmsorgDeviation.findByPk(req.params.id);
    if (!deviation) return res.status(404).json({ error: "Avvik ikke funnet" });

    const previousSeverity = deviation.severity;
    const previousStatus = deviation.status;

    await deviation.update({
      title: req.body?.title !== undefined ? String(req.body.title).trim() : deviation.title,
      category: req.body?.category !== undefined ? String(req.body.category).trim() : deviation.category,
      severity: req.body?.severity !== undefined ? String(req.body.severity).trim() : deviation.severity,
      status: req.body?.status !== undefined ? String(req.body.status).trim() : deviation.status,
      department: req.body?.department !== undefined ? String(req.body.department).trim() : deviation.department,
      source: req.body?.source !== undefined ? String(req.body.source).trim() : deviation.source,
      reported_at: req.body?.reportedAt !== undefined ? (req.body.reportedAt ? new Date(req.body.reportedAt) : null) : deviation.reported_at,
      due_at: req.body?.dueAt !== undefined ? (req.body.dueAt ? new Date(req.body.dueAt) : null) : deviation.due_at,
      responsible_role: req.body?.responsibleRole !== undefined ? String(req.body.responsibleRole).trim() : deviation.responsible_role,
      related_room: req.body?.relatedRoom !== undefined ? String(req.body.relatedRoom || "").trim() || null : deviation.related_room,
      tiltak: req.body?.tiltak !== undefined ? String(req.body.tiltak).trim() : deviation.tiltak,
      updated_at: new Date(),
    });

    await audit(req, "deviation.updated", "deviation", deviation.id, { severity: deviation.severity, status: deviation.status });

    const escalated =
      isCriticalOpenDeviation(deviation) &&
      (!CRITICAL_DEVIATION_SEVERITIES.has(previousSeverity) ||
        (previousStatus === "lukket" && deviation.status !== "lukket"));
    if (escalated) {
      const notifyResult = await notifyCriticalDeviation(deviation, req);
      await audit(req, notifyResult.sent ? "deviation.critical_notified" : "deviation.critical_notify_failed", "deviation", deviation.id, {
        sent: notifyResult.sent,
        reason: notifyResult.reason || null,
        escalated: true,
      });
    } else if (
      isMediumOpenDeviation(deviation) &&
      (previousSeverity !== "middels" || (previousStatus === "lukket" && deviation.status !== "lukket"))
    ) {
      const notifyResult = await notifyMediumDeviation(deviation, req);
      if (notifyResult.attempted) {
        await audit(req, notifyResult.sent ? "deviation.medium_notified" : "deviation.medium_notify_failed", "deviation", deviation.id, {
          sent: notifyResult.sent,
          reason: notifyResult.reason || null,
          escalated: true,
        });
      }
    }

    res.json(shapeDeviation(deviation));
  });

  router.get("/implementering", async (_req, res) => {
    const record = await getOrCreateImplementationState();
    res.json(shapeImplementationState(record));
  });

  router.patch("/implementering", async (req, res) => {
    const incomingState = req.body?.state;
    if (!incomingState || typeof incomingState !== "object" || Array.isArray(incomingState)) {
      return res.status(400).json({ error: "Implementeringsstatus må sendes som et objekt" });
    }

    const serialized = JSON.stringify({ ...DEFAULT_IMPLEMENTATION_STATE, ...incomingState });
    if (serialized.length > 250000) {
      return res.status(413).json({ error: "Implementeringsstatus er for stor" });
    }

    const record = await getOrCreateImplementationState();
    const previousState = parseImplementationState(record);
    await record.update({
      state_json: serialized,
      schema_version: 1,
      updated_by_user_id: req.user?.id || null,
      updated_at: new Date(),
    });

    const oldFeedback = Array.isArray(previousState.productFeedback) ? previousState.productFeedback : [];
    const newFeedback = Array.isArray(incomingState.productFeedback) ? incomingState.productFeedback : [];
    const addedFeedback = newFeedback.filter((entry) => entry?.id && !oldFeedback.some((old) => old.id === entry.id));

    for (const entry of addedFeedback) {
      await audit(req, "product_feedback.created", "product_feedback", String(entry.id), {
        category: String(entry.category || "annet"),
        preview: String(entry.body || "").slice(0, 200),
        authorName: entry.authorName ? String(entry.authorName) : null,
      });
      const notifyResult = await notifyProductFeedback(entry, req);
      if (notifyResult.attempted) {
        await audit(req, notifyResult.sent ? "product_feedback.notified" : "product_feedback.notify_failed", "product_feedback", String(entry.id), notifyResult);
      }
    }

    await audit(req, "implementation.updated", "implementation_state", record.id, {
      trainingEntries: Array.isArray(incomingState.trainingEntries) ? incomingState.trainingEntries.length : 0,
      completedWorkflows: incomingState.workflowDone ? Object.values(incomingState.workflowDone).filter(Boolean).length : 0,
      newFeedbackCount: addedFeedback.length,
    });

    res.json(shapeImplementationState(record));
  });

  router.get("/rapporter", async (req, res) => {
    const period = String(req.query.period || "uke").trim() === "maned" ? "maned" : "uke";
    const department = String(req.query.department || "").trim();
    const [courses, activities, checkoffs, comments, logs, supervisionRooms, deviations] = await Promise.all([
      OmsorgCourse.count(),
      OmsorgActivity.count(),
      OmsorgCheckoff.count(),
      OmsorgComment.count(),
      OmsorgAuditLog.count(),
      OmsorgDigitalSupervisionRoom.findAll(),
      OmsorgDeviation.findAll(),
    ]);

    const departments = [
      ...new Set([
        ...supervisionRooms.map((room) => room.department).filter(Boolean),
        ...deviations.map((deviation) => deviation.department).filter(Boolean),
      ]),
    ].sort((a, b) => a.localeCompare(b, "nb"));

    const filteredRooms = department ? supervisionRooms.filter((room) => room.department === department) : supervisionRooms;
    const filteredDeviations = department ? deviations.filter((deviation) => deviation.department === department) : deviations;

    const digitalSummary = digitalSummaryFromRows(filteredRooms);
    const deviationSummary = deviationSummaryFromRows(filteredDeviations);

    const completionRate = activities > 0 ? Math.round((checkoffs / activities) * 100) : 0;
    const generatedAt = new Date().toISOString();
    const periodLabel = period === "maned" ? "måned" : "uke";
    const departmentLabel = department ? ` · ${department}` : "";

    const [weeklyTrend, departmentStats, quarterlyTrendFull] = await Promise.all([
      buildWeeklyTrend(department),
      department ? Promise.resolve([]) : buildDepartmentStats(departments),
      buildQuarterlyTrend(department, 20),
    ]);
    const quarterlyTrend = quarterlyTrendFull.slice(-4);
    const longTermTrend = quarterlyTrendFull;
    const yearOverYear = buildYearOverYearComparison(quarterlyTrendFull);

    const reports = [
      {
        id: `rapport-tilsyn-${period}${department ? `-${department}` : ""}`,
        title: `Digitalt tilsyn - ${periodLabel}${departmentLabel}`,
        period,
        status: digitalSummary.kritisk > 0 || digitalSummary.offline > 0 ? "krever_oppfolging" : "stabil",
        generatedAt,
        summary: `${digitalSummary.total} rom i oversikten. ${digitalSummary.kritisk} kritiske, ${digitalSummary.oppmerksomhet} trenger oppmerksomhet og ${digitalSummary.offline} er offline.`,
        highlights: [
          `${digitalSummary.openTasks} åpne oppgaver knyttet til digitalt tilsyn.`,
          `${digitalSummary.ok} rom har status OK.`,
          "Oversikten viser romstatus og tilsynsoppfølging uten pasientidentifiserbare data.",
        ],
        actions: [
          "Følg opp rom med kritisk status først.",
          "Kontroller sensorer som er offline før neste vakt.",
          "Dokumenter manuell oppfølging i godkjent lokalt system.",
        ],
      },
      {
        id: `rapport-avvik-${period}${department ? `-${department}` : ""}`,
        title: `Avvik og forbedring - ${periodLabel}${departmentLabel}`,
        period,
        status: deviationSummary.hoy > 0 || deviationSummary.kritisk > 0 ? "krever_oppfolging" : "stabil",
        generatedAt,
        summary: `${deviationSummary.total} avvik i oversikten. ${deviationSummary.apen} åpne, ${deviationSummary.under_behandling} under behandling og ${deviationSummary.lukket} lukket.`,
        highlights: [
          `${deviationSummary.hoy + deviationSummary.kritisk} avvik er høy eller kritisk alvorlighetsgrad.`,
          `${deviationSummary.middels} avvik er middels alvorlighetsgrad.`,
          "Avvikene er koblet til tiltak, frist og ansvarlig rolle.",
        ],
        actions: [
          "Prioriter åpne avvik med høy alvorlighetsgrad.",
          "Sjekk at tiltak har ansvarlig rolle og realistisk frist.",
          "Bruk Care Assistenten til å strukturere lederoppsummering ved behov.",
        ],
      },
      {
        id: `rapport-kompetanse-${period}`,
        title: `Kurs og kompetanse - ${periodLabel}`,
        period,
        status: completionRate < 75 ? "krever_oppfolging" : "stabil",
        generatedAt,
        summary: `${courses} kurs, ${activities} aktiviteter og ${checkoffs} kryssinger registrert. Beregnet fullføringsgrad er ${completionRate}%.`,
        highlights: [
          `${comments} kommentarer kan gi nyttig kvalitativ innsikt.`,
          `${logs} logghendelser gir revisjonsspor for aktivitet i systemet.`,
          "Kompetanseoversikten bør brukes sammen med lokal opplæringsplan.",
        ],
        actions: [
          "Følg opp kurs med lav fullføringsgrad.",
          "Bruk kommentaroversikten til å finne praktiske hindringer.",
          "Sett av tid til opplæring på vakter der mange mangler kryssing.",
        ],
      },
    ];

    res.json({
      generatedAt,
      period,
      departments,
      filteredDepartment: department || null,
      summary: {
        courses,
        activities,
        checkoffs,
        comments,
        logs,
        completionRate,
        digitalSupervision: digitalSummary,
        deviations: deviationSummary,
      },
      weeklyTrend,
      quarterlyTrend,
      longTermTrend,
      yearOverYear,
      departmentStats,
      data: reports,
    });
  });

  router.post("/weekly-report/notify", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan sende ukesrapport-varsling" });
    }

    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Ukesrapport-tekst (body) er påkrevd" });

    const draft = {
      body,
      generatedAt: req.body?.generatedAt || new Date().toISOString(),
      period: String(req.body?.period || "uke").trim(),
      department: req.body?.department ? String(req.body.department).trim() : null,
      auto: Boolean(req.body?.auto),
    };

    const result = await notifyWeeklyReportDraft(draft, req);
    await audit(req, result.sent ? "weekly_report.notified" : "weekly_report.notify_failed", "weekly_report", null, {
      auto: draft.auto,
      sent: result.sent,
      reason: result.reason || null,
    });
    res.json(result);
  });

  async function notifyQuarterlyReviewReminder(payload, req) {
    const notifyEmail = (process.env.QUARTERLY_REVIEW_NOTIFY_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL || "").trim();
    const slackUrl = (process.env.QUARTERLY_REVIEW_SLACK_WEBHOOK_URL || process.env.FEEDBACK_SLACK_WEBHOOK_URL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const daysLabel = payload.daysSinceLast != null ? `${payload.daysSinceLast} dager siden sist` : "aldri registrert";
    const notes = String(payload.notes || "").trim();
    const attempts = [];

    if (slackUrl) {
      try {
        const response = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Kvartalsgjennomgang anbefales — OmsorgPilot",
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Kvartalsgjennomgang — OmsorgPilot" } },
              { type: "section", text: { type: "mrkdwn", text: `*Status:* ${daysLabel}\n*Notater:* ${notes || "—"}\n\nÅpne /admin/forbedring for sjekkliste.` } },
            ],
          }),
        });
        attempts.push({ channel: "slack", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "slack", sent: false, error: error.message });
      }
    }

    if (notifyEmail && resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || "OmsorgPilot <onboarding@resend.dev>",
            to: [notifyEmail],
            subject: "Kvartalsgjennomgang anbefales — Nordraaks OmsorgPilot",
            text: `Kvartalsvis gjennomgang av forbedringsplan og tilbakemeldinger anbefales.\n\nStatus: ${daysLabel}\n${notes ? `Notater: ${notes}\n` : ""}\nÅpne OmsorgPilot → Forbedring for sjekkliste.`,
          }),
        });
        attempts.push({ channel: "email", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "email", sent: false, error: error.message });
      }
    }

    if (!attempts.length) {
      return { attempted: false, sent: false, reason: "Ingen varsling konfigurert (QUARTERLY_REVIEW_NOTIFY_EMAIL / SLACK)" };
    }
    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  router.post("/quarterly-review/notify", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan sende kvartals-påminnelse" });
    }

    const result = await notifyQuarterlyReviewReminder(
      {
        notes: req.body?.notes ? String(req.body.notes).trim() : "",
        daysSinceLast: req.body?.daysSinceLast != null ? Number(req.body.daysSinceLast) : null,
      },
      req,
    );
    await audit(req, result.sent ? "quarterly_review.notified" : "quarterly_review.notify_failed", "quarterly_review", null, result);
    res.json(result);
  });

  async function notifyQuarterlyFeedbackReport(payload, req) {
    const notifyEmail = (process.env.QUARTERLY_FEEDBACK_NOTIFY_EMAIL || process.env.QUARTERLY_REVIEW_NOTIFY_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL || "").trim();
    const slackUrl = (process.env.QUARTERLY_FEEDBACK_SLACK_WEBHOOK_URL || process.env.QUARTERLY_REVIEW_SLACK_WEBHOOK_URL || process.env.FEEDBACK_SLACK_WEBHOOK_URL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const fullBody = String(payload.body || "");
    const preview = fullBody.slice(0, 2500);
    const entryCount = Number(payload.entryCount) || 0;
    const pdfName = `tilbakemelding-kvartal-${new Date().toISOString().slice(0, 10)}.pdf`;
    const txtName = `tilbakemelding-kvartal-${new Date().toISOString().slice(0, 10)}.txt`;
    const attempts = [];

    if (slackUrl) {
      try {
        const response = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Kvartalsrapport tilbakemeldinger — ${entryCount} innspill`,
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Kvartalsrapport tilbakemeldinger — OmsorgPilot" } },
              { type: "section", text: { type: "mrkdwn", text: preview.slice(0, 2800) } },
              { type: "context", elements: [{ type: "mrkdwn", text: "Åpne /admin/tilbakemelding for full oversikt." }] },
            ],
          }),
        });
        attempts.push({ channel: "slack", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "slack", sent: false, error: error.message });
      }
    }

    if (notifyEmail && resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: (process.env.QUARTERLY_FEEDBACK_NOTIFY_FROM || process.env.WEEKLY_REPORT_NOTIFY_FROM || process.env.FEEDBACK_NOTIFY_FROM || "OmsorgPilot <onboarding@resend.dev>").trim(),
            to: notifyEmail.split(",").map((item) => item.trim()).filter(Boolean),
            subject: `[OmsorgPilot] Kvartalsrapport tilbakemeldinger (${entryCount} innspill)`,
            text: `${preview}\n\n---\nGenerert: ${new Date().toISOString()}\nAntall: ${entryCount}\n\nVedlegg: .txt og forenklet .pdf`,
            attachments: fullBody
              ? [
                  { filename: txtName, content: Buffer.from(fullBody, "utf-8").toString("base64") },
                  { filename: pdfName, content: buildSimplePdf(fullBody).toString("base64") },
                ]
              : undefined,
          }),
        });
        attempts.push({ channel: "email", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "email", sent: false, error: error.message });
      }
    }

    if (!attempts.length) {
      return { attempted: false, sent: false, reason: "not_configured" };
    }

    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  router.post("/quarterly-feedback/notify", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan sende kvartalsrapport for tilbakemeldinger" });
    }

    const body = String(req.body?.body || "").trim();
    if (!body) {
      return res.status(400).json({ error: "body er påkrevd" });
    }

    const result = await notifyQuarterlyFeedbackReport(
      {
        body,
        entryCount: Number(req.body?.entryCount) || 0,
        auto: Boolean(req.body?.auto),
      },
      req,
    );
    await audit(req, result.sent ? "quarterly_feedback.notified" : "quarterly_feedback.notify_failed", "quarterly_feedback", null, {
      auto: Boolean(req.body?.auto),
      entryCount: Number(req.body?.entryCount) || 0,
      sent: result.sent,
      reason: result.reason || null,
    });
    res.json(result);
  });

  async function notifyQuarterlyStatsReport(payload, req) {
    const notifyEmail = (process.env.QUARTERLY_STATS_NOTIFY_EMAIL || process.env.QUARTERLY_REVIEW_NOTIFY_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL || "").trim();
    const slackUrl = (process.env.QUARTERLY_STATS_SLACK_WEBHOOK_URL || process.env.QUARTERLY_REVIEW_SLACK_WEBHOOK_URL || process.env.FEEDBACK_SLACK_WEBHOOK_URL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const fullBody = String(payload.body || "");
    const preview = fullBody.slice(0, 2500);
    const deptLabel = payload.department ? ` · ${payload.department}` : "";
    const pdfName = `kvartalsrapport-nokkeltall-${new Date().toISOString().slice(0, 10)}.pdf`;
    const txtName = `kvartalsrapport-nokkeltall-${new Date().toISOString().slice(0, 10)}.txt`;
    const attempts = [];

    if (slackUrl) {
      try {
        const response = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Kvartalsrapport nøkkeltall${deptLabel}`,
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Kvartalsrapport nøkkeltall — OmsorgPilot" } },
              { type: "section", text: { type: "mrkdwn", text: preview.slice(0, 2800) } },
            ],
          }),
        });
        attempts.push({ channel: "slack", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "slack", sent: false, error: error.message });
      }
    }

    if (notifyEmail && resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: (process.env.QUARTERLY_STATS_NOTIFY_FROM || process.env.WEEKLY_REPORT_NOTIFY_FROM || process.env.FEEDBACK_NOTIFY_FROM || "OmsorgPilot <onboarding@resend.dev>").trim(),
            to: notifyEmail.split(",").map((item) => item.trim()).filter(Boolean),
            subject: `[OmsorgPilot] Kvartalsrapport nøkkeltall${deptLabel}`,
            text: `${preview}\n\n---\nGenerert: ${new Date().toISOString()}${deptLabel}\n\nVedlegg: .txt og forenklet .pdf`,
            attachments: fullBody
              ? [
                  { filename: txtName, content: Buffer.from(fullBody, "utf-8").toString("base64") },
                  { filename: pdfName, content: buildSimplePdf(fullBody).toString("base64") },
                ]
              : undefined,
          }),
        });
        attempts.push({ channel: "email", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "email", sent: false, error: error.message });
      }
    }

    if (!attempts.length) {
      return { attempted: false, sent: false, reason: "not_configured" };
    }

    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  router.post("/quarterly-stats/notify", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan sende kvartalsrapport nøkkeltall" });
    }

    const body = String(req.body?.body || "").trim();
    if (!body) {
      return res.status(400).json({ error: "body er påkrevd" });
    }

    const result = await notifyQuarterlyStatsReport(
      {
        body,
        department: req.body?.department ? String(req.body.department).trim() : null,
        auto: Boolean(req.body?.auto),
      },
      req,
    );
    await audit(req, result.sent ? "quarterly_stats.notified" : "quarterly_stats.notify_failed", "quarterly_stats", null, {
      auto: Boolean(req.body?.auto),
      sent: result.sent,
      reason: result.reason || null,
    });
    res.json(result);
  });

  async function notifyQuarterlyCombinedReport(payload, req) {
    const notifyEmail = (process.env.QUARTERLY_COMBINED_NOTIFY_EMAIL || process.env.QUARTERLY_STATS_NOTIFY_EMAIL || process.env.QUARTERLY_REVIEW_NOTIFY_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL || "").trim();
    const slackUrl = (process.env.QUARTERLY_COMBINED_SLACK_WEBHOOK_URL || process.env.QUARTERLY_STATS_SLACK_WEBHOOK_URL || process.env.QUARTERLY_REVIEW_SLACK_WEBHOOK_URL || process.env.FEEDBACK_SLACK_WEBHOOK_URL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const fullBody = String(payload.body || "");
    const preview = fullBody.slice(0, 2500);
    const deptLabel = payload.department ? ` · ${payload.department}` : "";
    const pdfName = `kvartalsrapport-samlet-${new Date().toISOString().slice(0, 10)}.pdf`;
    const txtName = `kvartalsrapport-samlet-${new Date().toISOString().slice(0, 10)}.txt`;
    const attempts = [];

    if (slackUrl) {
      try {
        const response = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `Samlet kvartalsrapport${deptLabel}`,
            blocks: [
              { type: "header", text: { type: "plain_text", text: "Samlet kvartalsrapport — OmsorgPilot" } },
              { type: "section", text: { type: "mrkdwn", text: preview.slice(0, 2800) } },
            ],
          }),
        });
        attempts.push({ channel: "slack", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "slack", sent: false, error: error.message });
      }
    }

    if (notifyEmail && resendKey) {
      try {
        const attachments = fullBody
          ? [
              { filename: txtName, content: Buffer.from(fullBody, "utf-8").toString("base64") },
              { filename: pdfName, content: buildSimplePdf(fullBody).toString("base64") },
            ]
          : [];

        const deptAttachments = Array.isArray(payload.departmentAttachments) ? payload.departmentAttachments : [];
        for (const item of deptAttachments.slice(0, 8)) {
          const deptName = String(item.department || "avdeling")
            .replace(/[^\w\s-æøåÆØÅ]/g, "")
            .trim()
            .slice(0, 40);
          const deptBody = String(item.body || "");
          if (!deptBody) continue;
          const safeName = deptName || "avdeling";
          attachments.push({
            filename: `kvartal-${safeName}.txt`,
            content: Buffer.from(deptBody, "utf-8").toString("base64"),
          });
          attachments.push({
            filename: `kvartal-${safeName}.pdf`,
            content: buildSimplePdf(deptBody).toString("base64"),
          });
        }

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: (process.env.QUARTERLY_COMBINED_NOTIFY_FROM || process.env.QUARTERLY_STATS_NOTIFY_FROM || process.env.WEEKLY_REPORT_NOTIFY_FROM || process.env.FEEDBACK_NOTIFY_FROM || "OmsorgPilot <onboarding@resend.dev>").trim(),
            to: notifyEmail.split(",").map((item) => item.trim()).filter(Boolean),
            subject: `[OmsorgPilot] Samlet kvartalsrapport${deptLabel}`,
            text: `${preview}\n\n---\nGenerert: ${new Date().toISOString()}${deptLabel}\n\nVedlegg: hovedrapport + ${Math.max(0, deptAttachments.length)} avdeling(er)`,
            attachments: attachments.length ? attachments : undefined,
          }),
        });
        attempts.push({ channel: "email", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "email", sent: false, error: error.message });
      }
    }

    if (!attempts.length) {
      return { attempted: false, sent: false, reason: "not_configured", channels: attempts };
    }

    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  router.post("/quarterly-combined/notify", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan sende samlet kvartalsrapport" });
    }

    const body = String(req.body?.body || "").trim();
    if (!body) {
      return res.status(400).json({ error: "body er påkrevd" });
    }

    const result = await notifyQuarterlyCombinedReport(
      {
        body,
        department: req.body?.department ? String(req.body.department).trim() : null,
        departmentAttachments: Array.isArray(req.body?.departmentAttachments) ? req.body.departmentAttachments : [],
        auto: Boolean(req.body?.auto),
      },
      req,
    );
    await audit(req, result.sent ? "quarterly_combined.notified" : "quarterly_combined.notify_failed", "quarterly_combined", null, {
      auto: Boolean(req.body?.auto),
      sent: result.sent,
      reason: result.reason || null,
    });
    res.json(result);
  });

  async function notifyFaqExpiryReview(payload, req) {
    const notifyEmail = (process.env.FAQ_EXPIRY_NOTIFY_EMAIL || process.env.FEEDBACK_NOTIFY_EMAIL || process.env.QUARTERLY_REVIEW_NOTIFY_EMAIL || "").trim();
    const slackUrl = (process.env.FAQ_EXPIRY_SLACK_WEBHOOK_URL || process.env.FEEDBACK_SLACK_WEBHOOK_URL || "").trim();
    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const preview = String(payload.body || "").slice(0, 2500);
    const countLabel = payload.entryCount != null ? `${payload.entryCount} FAQ-poster` : "FAQ-poster";
    const attempts = [];

    if (slackUrl) {
      try {
        const response = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "FAQ krever gjennomgang — OmsorgPilot",
            blocks: [
              { type: "header", text: { type: "plain_text", text: "FAQ utløp — OmsorgPilot" } },
              { type: "section", text: { type: "mrkdwn", text: `*${countLabel}* krever gjennomgang.\n\n${preview.slice(0, 2800)}` } },
            ],
          }),
        });
        attempts.push({ channel: "slack", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "slack", sent: false, error: error.message });
      }
    }

    if (notifyEmail && resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: (process.env.FAQ_EXPIRY_NOTIFY_FROM || process.env.FEEDBACK_NOTIFY_FROM || "OmsorgPilot <onboarding@resend.dev>").trim(),
            to: notifyEmail.split(",").map((item) => item.trim()).filter(Boolean),
            subject: `[OmsorgPilot] FAQ krever gjennomgang (${countLabel})`,
            text: `${preview}\n\n---\nGenerert: ${new Date().toISOString()}\nÅpne /admin/hjelp for å fornye eller fjerne.`,
          }),
        });
        attempts.push({ channel: "email", sent: response.ok, status: response.status });
      } catch (error) {
        attempts.push({ channel: "email", sent: false, error: error.message });
      }
    }

    if (!attempts.length) {
      return { attempted: false, sent: false, reason: "not_configured", channels: attempts };
    }

    const sent = attempts.some((item) => item.sent);
    return { attempted: true, sent, channels: attempts };
  }

  router.post("/faq-expiry/notify", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun superbruker/leder kan sende FAQ-påminnelse" });
    }

    const body = String(req.body?.body || "").trim();
    if (!body) {
      return res.status(400).json({ error: "body er påkrevd" });
    }

    const result = await notifyFaqExpiryReview(
      {
        body,
        entryCount: Number(req.body?.entryCount) || 0,
        auto: Boolean(req.body?.auto),
      },
      req,
    );
    await audit(req, result.sent ? "faq_expiry.notified" : "faq_expiry.notify_failed", "faq_expiry", null, {
      auto: Boolean(req.body?.auto),
      sent: result.sent,
      reason: result.reason || null,
    });
    res.json(result);
  });

  router.get("/feedback/ticket-config", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan se ticket-konfigurasjon" });
    }
    res.json({
      jiraConfigured: Boolean((process.env.FEEDBACK_JIRA_WEBHOOK_URL || "").trim()),
      serviceNowConfigured: Boolean((process.env.FEEDBACK_SERVICENOW_WEBHOOK_URL || "").trim()),
    });
  });

  router.post("/feedback/ticket-forward", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan videresende til sakssystem" });
    }
    const entry = {
      id: String(req.body?.id || "").trim(),
      category: String(req.body?.category || "annet").trim(),
      body: String(req.body?.body || "").trim(),
      authorName: req.body?.authorName ? String(req.body.authorName).trim() : null,
      authorEmail: req.body?.authorEmail ? String(req.body.authorEmail).trim() : null,
      createdAt: req.body?.createdAt || new Date().toISOString(),
    };
    if (!entry.id || !entry.body) {
      return res.status(400).json({ error: "id og body er påkrevd" });
    }
    const result = await forwardFeedbackToTicketSystems(entry);
    await audit(req, result.sent ? "feedback.ticket_forwarded" : "feedback.ticket_forward_failed", "product_feedback", entry.id, {
      sent: result.sent,
      reason: result.reason || null,
    });
    res.json(result);
  });

  router.post("/quality-export/notify", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan eksportere til kvalitetssystem" });
    }
    const webhookUrl = (process.env.QUALITY_SYSTEM_WEBHOOK_URL || "").trim();
    const body = String(req.body?.body || "").trim();
    if (!webhookUrl) {
      return res.json({ attempted: false, sent: false, reason: "not_configured" });
    }
    if (!body) {
      return res.status(400).json({ error: "body er påkrevd" });
    }
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "OmsorgPilot", type: "quality_export", body, exportedAt: new Date().toISOString() }),
      });
      const sent = response.ok;
      await audit(req, sent ? "quality_export.notified" : "quality_export.notify_failed", "quality_export", null, { sent, status: response.status });
      res.json({ attempted: true, sent, status: response.status });
    } catch (error) {
      await audit(req, "quality_export.notify_failed", "quality_export", null, { error: error.message });
      res.json({ attempted: true, sent: false, reason: error.message });
    }
  });

  router.get("/integrations/epj/comment-merge/config", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan se EPJ merge-konfigurasjon" });
    }
    res.json({
      webhookConfigured: Boolean((process.env.EPJ_COMMENT_MERGE_WEBHOOK_URL || "").trim()),
    });
  });

  router.post("/integrations/epj/comment-merge/notify", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan varsle EPJ merge" });
    }
    const webhookUrl = (process.env.EPJ_COMMENT_MERGE_WEBHOOK_URL || "").trim();
    const activityId = String(req.body?.activityId || "").trim();
    const mergedBody = String(req.body?.mergedBody || "").trim();
    if (!webhookUrl) {
      return res.json({ attempted: false, sent: false, reason: "not_configured" });
    }
    if (!activityId || !mergedBody) {
      return res.status(400).json({ error: "activityId og mergedBody er påkrevd" });
    }
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "OmsorgPilot",
          type: "epj_comment_merge",
          activityId,
          courseId: req.body?.courseId ? String(req.body.courseId) : null,
          mode: req.body?.mode ? String(req.body.mode) : "manual",
          mergedBody: mergedBody.slice(0, 8000),
          exportedAt: new Date().toISOString(),
        }),
      });
      const sent = response.ok;
      await audit(req, sent ? "epj_comment_merge.notified" : "epj_comment_merge.notify_failed", "integration", "visma-profil", {
        sent,
        status: response.status,
        activityId,
      });
      res.json({ attempted: true, sent, status: response.status });
    } catch (error) {
      await audit(req, "epj_comment_merge.notify_failed", "integration", "visma-profil", { error: error.message, activityId });
      res.json({ attempted: true, sent: false, reason: error.message });
    }
  });

  router.get("/integrations/mer/quiz-export/config", async (req, res) => {
    const role = req.user?.role;
    if (!["admin", "superuser"].includes(role)) {
      return res.status(403).json({ error: "Kun superbruker kan se MER quiz-eksport" });
    }
    res.json({
      webhookConfigured: Boolean((process.env.MER_QUIZ_EXPORT_WEBHOOK_URL || "").trim()),
    });
  });

  router.post("/integrations/mer/quiz-export", async (req, res) => {
    const role = req.user?.role;
    if (!["admin", "superuser"].includes(role)) {
      return res.status(403).json({ error: "Kun superbruker kan eksportere MER quiz" });
    }
    const webhookUrl = (process.env.MER_QUIZ_EXPORT_WEBHOOK_URL || "").trim();
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    if (!webhookUrl) {
      return res.json({ attempted: false, sent: false, reason: "not_configured", entryCount: entries.length });
    }
    if (!entries.length) {
      return res.status(400).json({ error: "entries er påkrevd" });
    }
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "OmsorgPilot",
          type: "mer_quiz_export",
          exportedAt: new Date().toISOString(),
          entries: entries.slice(0, 500),
        }),
      });
      const sent = response.ok;
      await audit(req, sent ? "mer_quiz_export.notified" : "mer_quiz_export.notify_failed", "integration", "merkompetanse", {
        sent,
        status: response.status,
        entryCount: entries.length,
      });
      res.json({ attempted: true, sent, status: response.status, entryCount: entries.length });
    } catch (error) {
      await audit(req, "mer_quiz_export.notify_failed", "integration", "merkompetanse", { error: error.message, entryCount: entries.length });
      res.json({ attempted: true, sent: false, reason: error.message, entryCount: entries.length });
    }
  });

  router.get("/integrations/sensio/webhook/config", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan se Sensio webhook-konfigurasjon" });
    }

    const base = (process.env.OMSORG_PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    res.json({
      webhookUrl: `${base}/api/v1/omsorg/integrations/sensio/webhook`,
      secretConfigured: Boolean((process.env.SENSIO_WEBHOOK_SECRET || "").trim()),
    });
  });

  router.post("/integrations/sensio/webhook", async (req, res) => {
    const secret = (process.env.SENSIO_WEBHOOK_SECRET || "").trim();
    const provided = String(req.headers["x-sensio-secret"] || req.headers["x-sensio-webhook-secret"] || "").trim();
    if (!secret || provided !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body && typeof req.body === "object" ? req.body : {};
    await audit(req, "sensio.webhook_received", "integration", "sensio", {
      eventType: payload.eventType || payload.type || payload.event || "unknown",
      preview: JSON.stringify(payload).slice(0, 500),
    });
    res.json({ received: true, at: new Date().toISOString() });
  });

  router.get("/push/vapid-public-key", (_req, res) => {
    const publicKey = (process.env.VAPID_PUBLIC_KEY || "").trim();
    if (!publicKey) return res.status(503).json({ error: "Web Push er ikke konfigurert (VAPID_PUBLIC_KEY)" });
    res.json({ publicKey });
  });

  router.post("/push/subscribe", async (req, res) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ error: "Kun ledere kan abonnere på Web Push" });
    }

    const endpoint = String(req.body?.endpoint || "").trim();
    if (!endpoint) return res.status(400).json({ error: "Push-abonnement (endpoint) er påkrevd" });

    const subscription = {
      endpoint,
      expirationTime: req.body?.expirationTime ?? null,
      keys: req.body?.keys || {},
    };
    const now = new Date();
    const existing = await OmsorgPushSubscription.findOne({ where: { endpoint } });

    if (existing) {
      await existing.update({
        user_id: req.user.id,
        subscription_json: JSON.stringify(subscription),
        updated_at: now,
      });
    } else {
      await OmsorgPushSubscription.create({
        user_id: req.user.id,
        endpoint,
        subscription_json: JSON.stringify(subscription),
        created_at: now,
        updated_at: now,
      });
    }

    await audit(req, "push.subscribed", "push_subscription", endpoint.slice(0, 120), { userId: req.user.id });
    res.status(201).json({ ok: true });
  });

  router.delete("/push/subscribe", async (req, res) => {
    const endpoint = String(req.body?.endpoint || "").trim();
    if (!endpoint) return res.status(400).json({ error: "endpoint er påkrevd" });
    await OmsorgPushSubscription.destroy({ where: { endpoint, user_id: req.user?.id || null } });
    res.json({ ok: true });
  });

  async function buildEmployeeTrainingStats(userId, department = "") {
    let totalActivities;
    let completedActivities;

    if (department) {
      const coursesInDept = await OmsorgCourse.findAll({ where: { department }, attributes: ["id"] });
      const courseIds = coursesInDept.map((course) => course.id);
      totalActivities = courseIds.length ? await OmsorgActivity.count({ where: { course_id: { [Op.in]: courseIds } } }) : 0;
      completedActivities = courseIds.length
        ? await OmsorgCheckoff.count({ where: { employee_id: userId, course_id: { [Op.in]: courseIds } } })
        : 0;
    } else {
      totalActivities = await OmsorgActivity.count();
      completedActivities = await OmsorgCheckoff.count({ where: { employee_id: userId } });
    }

    const trainingCompletionRate =
      totalActivities > 0 ? Math.min(100, Math.round((completedActivities / totalActivities) * 100)) : 0;
    return {
      totalActivities,
      completedActivities,
      trainingCompletionRate,
      trainingGoalMet: trainingCompletionRate >= 90,
    };
  }

  router.get("/employees", async (req, res) => {
    const { page, limit, offset } = pagination(req);
    const q = String(req.query.q || "").trim();
    const department = String(req.query.department || "").trim();
    const where = {};
    if (q) {
      where[Op.or] = [
        { email: { [Op.like]: `%${q}%` } },
        { name: { [Op.like]: `%${q}%` } },
        { role: { [Op.like]: `%${q}%` } },
      ];
    }
    if (req.query.status) where.role = String(req.query.status);

    const result = await User.findAndCountAll({ where, limit, offset, order: order(req, "id") });
    const rows = await Promise.all(
      result.rows.map(async (user) => {
        const training = await buildEmployeeTrainingStats(user.id, department);
        const lastCheckoff = await OmsorgCheckoff.findOne({
          where: { employee_id: user.id },
          order: [["checked_at", "DESC"]],
        });
        return {
          ...shapeUser(user),
          courseCount: 0,
          ...training,
          lastActivityAt: lastCheckoff?.checked_at || null,
        };
      }),
    );

    res.json(paginated(rows, result.count, page, limit));
  });

  router.get("/employees/:id", async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "Ansatt ikke funnet" });
    const training = await buildEmployeeTrainingStats(user.id);
    const lastCheckoff = await OmsorgCheckoff.findOne({ where: { employee_id: user.id }, order: [["checked_at", "DESC"]] });
    res.json({
      ...shapeUser(user),
      courseCount: 0,
      ...training,
      lastActivityAt: lastCheckoff?.checked_at || null,
    });
  });

  router.get("/courses", async (req, res) => {
    const { page, limit, offset } = pagination(req);
    const q = String(req.query.q || "").trim();
    const where = {};
    if (q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
        { department: { [Op.like]: `%${q}%` } },
      ];
    }
    if (req.query.status) where.status = String(req.query.status);

    const result = await OmsorgCourse.findAndCountAll({ where, limit, offset, order: order(req, "created_at") });
    const rows = await Promise.all(
      result.rows.map(async (course) => {
        const activityCount = await OmsorgActivity.count({ where: { course_id: course.id } });
        const checkoffCount = await OmsorgCheckoff.count({ where: { course_id: course.id } });
        return shapeCourse(course, {
          activityCount,
          completionRate: activityCount > 0 ? Math.round((checkoffCount / activityCount) * 100) : 0,
        });
      }),
    );
    res.json(paginated(rows, result.count, page, limit));
  });

  router.post("/courses", async (req, res) => {
    const now = new Date();
    const course = await OmsorgCourse.create({
      title: String(req.body?.title || "").trim(),
      description: req.body?.description ? String(req.body.description).trim() : null,
      department: req.body?.department ? String(req.body.department).trim() : null,
      status: req.body?.status ? String(req.body.status) : "active",
      due_at: req.body?.dueAt ? new Date(req.body.dueAt) : null,
      created_by_user_id: req.user.id,
      created_at: now,
      updated_at: now,
    });
    await audit(req, "course.created", "course", course.id, { title: course.title });
    res.status(201).json(shapeCourse(course));
  });

  router.get("/courses/:id", async (req, res) => {
    const course = await OmsorgCourse.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: "Kurs ikke funnet" });
    const activityCount = await OmsorgActivity.count({ where: { course_id: course.id } });
    const checkoffCount = await OmsorgCheckoff.count({ where: { course_id: course.id } });
    res.json(shapeCourse(course, { activityCount, completionRate: activityCount ? Math.round((checkoffCount / activityCount) * 100) : 0 }));
  });

  router.patch("/courses/:id", async (req, res) => {
    const course = await OmsorgCourse.findByPk(req.params.id);
    if (!course) return res.status(404).json({ error: "Kurs ikke funnet" });
    await course.update({
      title: req.body?.title !== undefined ? String(req.body.title).trim() : course.title,
      description: req.body?.description !== undefined ? String(req.body.description || "").trim() || null : course.description,
      department: req.body?.department !== undefined ? String(req.body.department || "").trim() || null : course.department,
      status: req.body?.status !== undefined ? String(req.body.status) : course.status,
      due_at: req.body?.dueAt !== undefined ? (req.body.dueAt ? new Date(req.body.dueAt) : null) : course.due_at,
      updated_at: new Date(),
    });
    await audit(req, "course.updated", "course", course.id, { title: course.title });
    res.json(shapeCourse(course));
  });

  router.get("/courses/:courseId/activities", async (req, res) => {
    const { page, limit, offset } = pagination(req);
    const where = { course_id: req.params.courseId };
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.q) where.title = { [Op.like]: `%${String(req.query.q).trim()}%` };
    const result = await OmsorgActivity.findAndCountAll({ where, limit, offset, order: [["sort_order", "ASC"]] });
    const rows = await Promise.all(
      result.rows.map(async (activity) => shapeActivity(activity, { checkoffCount: await OmsorgCheckoff.count({ where: { activity_id: activity.id } }) })),
    );
    res.json(paginated(rows, result.count, page, limit));
  });

  router.post("/courses/:courseId/activities", async (req, res) => {
    const now = new Date();
    const activity = await OmsorgActivity.create({
      course_id: req.params.courseId,
      title: String(req.body?.title || "").trim(),
      description: req.body?.description ? String(req.body.description).trim() : null,
      status: req.body?.status ? String(req.body.status) : "active",
      required: req.body?.required !== undefined ? Boolean(req.body.required) : true,
      sort_order: Number(req.body?.sortOrder || 0),
      created_at: now,
      updated_at: now,
    });
    await audit(req, "activity.created", "activity", activity.id, { courseId: activity.course_id, title: activity.title });
    res.status(201).json(shapeActivity(activity));
  });

  router.get("/checkoffs", async (req, res) => {
    const { page, limit, offset } = pagination(req);
    const department = String(req.query.department || "").trim();
    const where = { ...dateRangeWhere(req, "checked_at") };
    if (req.query.courseId) where.course_id = String(req.query.courseId);
    if (req.query.activityId) where.activity_id = String(req.query.activityId);
    if (req.query.employeeId) where.employee_id = Number(req.query.employeeId);
    const courseInclude = {
      model: OmsorgCourse,
      ...(department ? { where: { department }, required: true } : {}),
    };
    const result = await OmsorgCheckoff.findAndCountAll({
      where,
      limit,
      offset,
      order: order(req, "checked_at"),
      include: [{ model: User, as: "employee" }, courseInclude, { model: OmsorgActivity }],
    });
    res.json(paginated(result.rows.map(shapeCheckoff), result.count, page, limit));
  });

  router.post("/checkoffs", async (req, res) => {
    const employeeId = Number(req.body?.employeeId || req.user.id);
    const courseId = String(req.body?.courseId || "");
    const activityId = String(req.body?.activityId || "");

    const existing = await OmsorgCheckoff.findOne({
      where: { employee_id: employeeId, activity_id: activityId, course_id: courseId },
      include: [{ model: User, as: "employee" }, { model: OmsorgCourse }, { model: OmsorgActivity }],
    });

    if (existing) {
      return res.json({ ...shapeCheckoff(existing), duplicate: true });
    }

    const checkoff = await OmsorgCheckoff.create({
      course_id: courseId,
      activity_id: activityId,
      employee_id: employeeId,
      checked_by_user_id: req.user.id,
      checked_at: req.body?.checkedAt ? new Date(req.body.checkedAt) : new Date(),
      note: req.body?.note ? String(req.body.note).trim() : null,
    });
    await audit(req, "checkoff.created", "checkoff", checkoff.id, {
      courseId: checkoff.course_id,
      activityId: checkoff.activity_id,
      employeeId: checkoff.employee_id,
    });
    const shaped = await OmsorgCheckoff.findByPk(checkoff.id, {
      include: [{ model: User, as: "employee" }, { model: OmsorgCourse }, { model: OmsorgActivity }],
    });
    res.status(201).json(shapeCheckoff(shaped));
  });

  router.get("/comments", async (req, res) => {
    const { page, limit, offset } = pagination(req);
    const department = String(req.query.department || "").trim();
    const where = { ...dateRangeWhere(req, "created_at") };
    if (req.query.courseId) where.course_id = String(req.query.courseId);
    if (req.query.activityId) where.activity_id = String(req.query.activityId);
    if (req.query.employeeId) where.employee_id = Number(req.query.employeeId);
    if (req.query.q) where.body = { [Op.like]: `%${String(req.query.q).trim()}%` };
    const courseInclude = {
      model: OmsorgCourse,
      ...(department ? { where: { department }, required: true } : {}),
    };
    const result = await OmsorgComment.findAndCountAll({
      where,
      limit,
      offset,
      order: order(req, "created_at"),
      include: [{ model: User, as: "employee" }, { model: User, as: "author" }, courseInclude, { model: OmsorgActivity }],
    });
    res.json(paginated(result.rows.map(shapeComment), result.count, page, limit));
  });

  router.post("/comments", async (req, res) => {
    const activityId = req.body?.activityId ? String(req.body.activityId) : null;
    const trimmedBody = String(req.body?.body || "").trim();
    if (!trimmedBody) return res.status(400).json({ error: "Kommentartekst er påkrevd" });

    const duplicateWhere = {
      author_user_id: req.user.id,
      body: trimmedBody,
      ...(activityId ? { activity_id: activityId } : {}),
    };
    const existing = await OmsorgComment.findOne({ where: duplicateWhere, order: [["created_at", "DESC"]] });
    if (existing) {
      return res.json({ ...shapeComment(existing), duplicate: true });
    }

    const comment = await OmsorgComment.create({
      course_id: req.body?.courseId ? String(req.body.courseId) : null,
      activity_id: activityId,
      employee_id: req.body?.employeeId ? Number(req.body.employeeId) : null,
      author_user_id: req.user.id,
      body: trimmedBody,
      created_at: new Date(),
    });
    await audit(req, "comment.created", "comment", comment.id, { courseId: comment.course_id, activityId: comment.activity_id });
    res.status(201).json(shapeComment(comment));
  });

  router.get("/logs", async (req, res) => {
    const { page, limit, offset } = pagination(req);
    const where = { ...dateRangeWhere(req, "created_at") };
    if (req.query.employeeId) where.actor_user_id = Number(req.query.employeeId);
    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      where[Op.or] = [{ action: { [Op.like]: q } }, { entity_type: { [Op.like]: q } }, { entity_id: { [Op.like]: q } }];
    }
    const result = await OmsorgAuditLog.findAndCountAll({
      where,
      limit,
      offset,
      order: order(req, "created_at"),
      include: [{ model: User, as: "actor" }],
    });
    res.json(paginated(result.rows.map(shapeLog), result.count, page, limit));
  });

  return router;
}

module.exports = buildOmsorgRouter;
