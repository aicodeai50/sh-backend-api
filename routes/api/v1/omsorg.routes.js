const express = require("express");
const { Op } = require("sequelize");
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
} = require("../../../database");

const ADMIN_ROLES = ["admin", "superuser", "company_admin", "instructor"];

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
    description: "Pleie- og omsorgssystem/EPJ brukt i kommunale helse- og omsorgstjenester.",
    integrationNotes: "Aktuell for journalføring, avtaler, meldinger og dokumentasjon. Krever leverandøravtale og databehandleravklaring.",
  },
  {
    id: "gerica-lifecare",
    name: "Gerica / Lifecare",
    category: "epj",
    status: "krever_avtale",
    baerumRelevant: false,
    digitalTilsynRelevant: true,
    description: "Kommunalt pleie- og omsorgssystem/EPJ fra Tietoevry.",
    integrationNotes: "Relevant nasjonalt for kommuner som bruker Gerica/Lifecare. Ikke markert som Bærum-spesifikk her.",
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
      course: checkoff.OmsorgCourse ? { id: checkoff.OmsorgCourse.id, title: checkoff.OmsorgCourse.title } : null,
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
      course: comment.OmsorgCourse ? { id: comment.OmsorgCourse.id, title: comment.OmsorgCourse.title } : null,
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

  function careAssistantSystemPrompt() {
    return [
      "Du er Care Assistenten i OmsorgPilot for Bærum kommune, Helse og omsorg, Nordraaks vei sykehjem.",
      "Svar alltid på norsk, praktisk, strukturert og med en trygg profesjonell tone.",
      "Du hjelper superbruker, ledere og ansatte med digitalt tilsyn, RoomMate, Sensio Care, Sensio 365, kurs, sjekklister, avvik, rapporter, opplæring, personvern, nattevakt og implementering.",
      "Du kan lage utkast til ukesrapporter, avdelingsrapporter, tiltakslister, sjekklister, opplæringsplaner og lederoppsummeringer.",
      "Du skal ikke late som du er helsepersonell, lege, sykepleier eller juridisk rådgiver.",
      "Ikke be om pasientidentifiserbare opplysninger. Hvis brukeren skriver sensitive opplysninger, svar generelt og be dem bruke godkjent journalsystem/lokale rutiner.",
      "Ved akutt fare, pasientsikkerhet, medisinske spørsmål eller usikkerhet skal du be brukeren følge lokale rutiner og kontakte ansvarlig helsepersonell eller leder.",
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
      return res.json({ ok: true, answer: external.answer, source: external.source });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
    });

    const answer = completion.choices?.[0]?.message?.content || "Jeg klarte ikke å lage et svar akkurat nå.";
    await audit(req, "care_assistant.asked", "care_assistant", null, { question: question.slice(0, 500) });
    res.json({ ok: true, answer, source: "local-openai" });
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
    res.json({ data: tools.map(shapeHealthTool) });
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
    res.status(201).json(shapeDeviation(deviation));
  });

  router.patch("/avvik/:id", async (req, res) => {
    const deviation = await OmsorgDeviation.findByPk(req.params.id);
    if (!deviation) return res.status(404).json({ error: "Avvik ikke funnet" });

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
    await record.update({
      state_json: serialized,
      schema_version: 1,
      updated_by_user_id: req.user?.id || null,
      updated_at: new Date(),
    });

    await audit(req, "implementation.updated", "implementation_state", record.id, {
      trainingEntries: Array.isArray(incomingState.trainingEntries) ? incomingState.trainingEntries.length : 0,
      completedWorkflows: incomingState.workflowDone ? Object.values(incomingState.workflowDone).filter(Boolean).length : 0,
    });

    res.json(shapeImplementationState(record));
  });

  router.get("/rapporter", async (req, res) => {
    const period = String(req.query.period || "uke").trim() === "maned" ? "maned" : "uke";
    const [courses, activities, checkoffs, comments, logs, supervisionRooms, deviations] = await Promise.all([
      OmsorgCourse.count(),
      OmsorgActivity.count(),
      OmsorgCheckoff.count(),
      OmsorgComment.count(),
      OmsorgAuditLog.count(),
      OmsorgDigitalSupervisionRoom.findAll(),
      OmsorgDeviation.findAll(),
    ]);

    const digitalSummary = digitalSummaryFromRows(supervisionRooms);
    const deviationSummary = deviationSummaryFromRows(deviations);

    const completionRate = activities > 0 ? Math.round((checkoffs / activities) * 100) : 0;
    const generatedAt = new Date().toISOString();
    const periodLabel = period === "maned" ? "måned" : "uke";

    const reports = [
      {
        id: `rapport-tilsyn-${period}`,
        title: `Digitalt tilsyn - ${periodLabel}`,
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
        id: `rapport-avvik-${period}`,
        title: `Avvik og forbedring - ${periodLabel}`,
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
      data: reports,
    });
  });

  router.get("/employees", async (req, res) => {
    const { page, limit, offset } = pagination(req);
    const q = String(req.query.q || "").trim();
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
      result.rows.map(async (user) => ({
        ...shapeUser(user),
        courseCount: 0,
        completedActivities: await OmsorgCheckoff.count({ where: { employee_id: user.id } }),
        lastActivityAt:
          (
            await OmsorgCheckoff.findOne({
              where: { employee_id: user.id },
              order: [["checked_at", "DESC"]],
            })
          )?.checked_at || null,
      })),
    );

    res.json(paginated(rows, result.count, page, limit));
  });

  router.get("/employees/:id", async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "Ansatt ikke funnet" });
    const completedActivities = await OmsorgCheckoff.count({ where: { employee_id: user.id } });
    const lastCheckoff = await OmsorgCheckoff.findOne({ where: { employee_id: user.id }, order: [["checked_at", "DESC"]] });
    res.json({
      ...shapeUser(user),
      courseCount: 0,
      completedActivities,
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
    const where = { ...dateRangeWhere(req, "checked_at") };
    if (req.query.courseId) where.course_id = String(req.query.courseId);
    if (req.query.activityId) where.activity_id = String(req.query.activityId);
    if (req.query.employeeId) where.employee_id = Number(req.query.employeeId);
    const result = await OmsorgCheckoff.findAndCountAll({
      where,
      limit,
      offset,
      order: order(req, "checked_at"),
      include: [
        { model: User, as: "employee" },
        { model: OmsorgCourse },
        { model: OmsorgActivity },
      ],
    });
    res.json(paginated(result.rows.map(shapeCheckoff), result.count, page, limit));
  });

  router.post("/checkoffs", async (req, res) => {
    const checkoff = await OmsorgCheckoff.create({
      course_id: String(req.body?.courseId || ""),
      activity_id: String(req.body?.activityId || ""),
      employee_id: Number(req.body?.employeeId || req.user.id),
      checked_by_user_id: req.user.id,
      checked_at: req.body?.checkedAt ? new Date(req.body.checkedAt) : new Date(),
      note: req.body?.note ? String(req.body.note).trim() : null,
    });
    await audit(req, "checkoff.created", "checkoff", checkoff.id, {
      courseId: checkoff.course_id,
      activityId: checkoff.activity_id,
      employeeId: checkoff.employee_id,
    });
    res.status(201).json(shapeCheckoff(checkoff));
  });

  router.get("/comments", async (req, res) => {
    const { page, limit, offset } = pagination(req);
    const where = { ...dateRangeWhere(req, "created_at") };
    if (req.query.courseId) where.course_id = String(req.query.courseId);
    if (req.query.activityId) where.activity_id = String(req.query.activityId);
    if (req.query.employeeId) where.employee_id = Number(req.query.employeeId);
    if (req.query.q) where.body = { [Op.like]: `%${String(req.query.q).trim()}%` };
    const result = await OmsorgComment.findAndCountAll({
      where,
      limit,
      offset,
      order: order(req, "created_at"),
      include: [
        { model: User, as: "employee" },
        { model: User, as: "author" },
        { model: OmsorgCourse },
        { model: OmsorgActivity },
      ],
    });
    res.json(paginated(result.rows.map(shapeComment), result.count, page, limit));
  });

  router.post("/comments", async (req, res) => {
    const comment = await OmsorgComment.create({
      course_id: req.body?.courseId ? String(req.body.courseId) : null,
      activity_id: req.body?.activityId ? String(req.body.activityId) : null,
      employee_id: req.body?.employeeId ? Number(req.body.employeeId) : null,
      author_user_id: req.user.id,
      body: String(req.body?.body || "").trim(),
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
