export type Lang = "id" | "en";

export interface I18nCatalog {
  // Navigation & Sidebar
  appTitle: string;
  appSubtitle: string;
  overviewSection: string;
  pipelineSection: string;
  onboardingTab: string;
  decideTab: string;
  dataTab: string;
  trainTab: string;
  playerTab: string;
  runsTab: string;
  glossaryButton: string;
  shortcutsButton: string;
  referenceSection: string;
  sidebarClickHint: string;
  openInNewTab: (name: string) => string;

  // Workspace Tab Bar
  closeAllTabs: string;
  closeAllTooltip: string;
  closeTab: string;
  closeCurrentTab: string;
  closeOtherTabs: string;
  newTab: string;
  newTabTooltip: string;
  openTabsTitle: string;
  clickToSwitch: string;
  searchTabsPlaceholder: string;
  overflowBadge: string;

  // Decision View
  decideHeadlineTitle: string;
  decideHorizonPrefix: string;
  decideFreshnessPrefix: string;
  decideStationPrefix: string;
  decideDriversTitle: string;
  decideDriversSubtitle: string;
  decideConfidenceTitle: string;
  decideConfidenceSubtitle: string;
  decideActionsTitle: string;
  decideActionsSubtitle: string;
  decideNextStepsTitle: string;
  decideSeePlayer: string;
  decideCompareRuns: string;
  decideExportReport: string;
  decideEmptyTitle: string;
  decideEmptyDesc: string;
  decideEmptyCta: string;

  // Caveats & Confidence
  caveatEstimatedData: (count: number) => string;
  caveatMethodAutomatic: string;
  caveatAgreement: (cls: string) => string;
  caveatGridTruncated: string;
  caveatEdgeNa: string;
  caveatUnboundedSm: string;
  caveatHighConfidence: string;

  // Classes
  classLow: string;
  classModerate: string;
  classHigh: string;
  classExtreme: string;

  // Glossary
  glossaryTitle: string;
  glossaryClose: string;
  glossaryWtTitle: string;
  glossaryWtDesc: string;
  glossarySmTitle: string;
  glossarySmDesc: string;
  glossaryRfTitle: string;
  glossaryRfDesc: string;
  glossaryTempTitle: string;
  glossaryTempDesc: string;
  glossaryPfviTitle: string;
  glossaryPfviDesc: string;
  glossaryClassesTitle: string;
  glossaryClassesDesc: string;

  // Model Training (TrainPage)
  trainTitle: string;
  trainSubtitle: string;
  trainMathDocs: string;
  trainMathDocsTooltip: string;
  trainResizeHint: string;
  trainPresetsTitle: string;
  trainCustomModified: string;
  trainPresetApplied: (name: string) => string;
  trainTargetDataset: string;
  trainDatasetsLoaded: (count: number) => string;
  trainNoDatasetPlaceholder: string;
  trainNoDatasetEmptyText: string;
  trainNoDatasetWarningTitle: string;
  trainNoDatasetWarningDesc: string;
  trainGoToData: string;
  trainTotalTimesteps: string;
  trainRows: string;
  trainMissingGaps: string;
  trainPastRuns: (count: number) => string;
  trainInspectInData: string;
  trainImputationTitle: string;
  trainImputationInfoTitle: string;
  trainImputationInfoDesc: string;
  trainImputationKnnDesc: string;
  trainImputationLinearDesc: string;
  trainImputationSplineDesc: string;
  trainImputationLoessDesc: string;
  trainImputationKnnParam: string;
  trainImputationKnnHint: string;
  trainImputationLoessParam: string;
  trainImputationLoessHint: string;
  trainImputationLinearBanner: string;
  trainImputationSplineBanner: string;
  trainForecasterTitle: string;
  trainForecasterInfoTitle: string;
  trainForecasterInfoDesc: string;
  trainForecasterArimaBadge: string;
  trainForecasterArimaDesc: string;
  trainForecasterLstmBadge: string;
  trainForecasterLstmDesc: string;
  trainForecasterGruBadge: string;
  trainForecasterGruDesc: string;
  trainForecasterDefaultDesc: string;
  trainSplitRatioParam: string;
  trainSplitRatioHint: string;
  trainDlArch: (name: string) => string;
  trainDlDeviceCpu: string;
  trainDlDeviceGpu: string;
  trainDlLookback: string;
  trainDlEpochs: string;
  trainDlUnits: string;
  trainDlBatchSize: string;
  trainDlFullBatch: string;
  trainDlFullBatchDesc: string;
  trainDlLearningRate: string;
  trainDlLearningRateHint: string;
  trainDlGuideTitle: string;
  trainDlGuideLookbackTitle: string;
  trainDlGuideLookbackDesc: string;
  trainDlGuideEpochsTitle: string;
  trainDlGuideEpochsDesc: string;
  trainDlGuideUnitsTitle: string;
  trainDlGuideUnitsDesc: string;
  trainDlGuideBatchTitle: string;
  trainDlGuideBatchDesc: string;
  trainDlGuideLrTitle: string;
  trainDlGuideLrDesc: string;
  trainDlGuideHardwareTitle: string;
  trainDlGuideHardwareDesc: string;
  trainDlBatchFit: (backend: string, range: string) => string;
  trainDlGpuActive: (name: string, backend: string) => string;
  trainDlGpuRequested: string;
  trainDlCpuActive: string;
  trainDlGpuUnavailable: string;
  trainGpuAccel: string;
  trainGpuScore: (score: number) => string;
  trainGpuDefaultName: string;
  trainGpuDefaultTier: string;
  trainGpuNoGpu: string;
  trainGpuBenchmarkScore: string;
  trainGpuVram: string;
  trainGpuEstSpeedup: string;
  trainGpuDriver: (driver: string) => string;
  trainGpuHardwareLayer: string;
  trainPfviSettingsTitle: string;
  trainPfviInfoTitle: string;
  trainPfviInfoDesc: string;
  trainPfviHorizonParam: string;
  trainPfviAnnualRainParam: string;
  trainPfviMaxGridParam: string;
  trainPfviRandomSeed: string;
  trainPfviRandomBtn: string;
  trainStartBtn: string;
  trainStartingBtn: string;
  trainPleaseSelectDataset: string;
  trainJobQueuedSuccess: string;
  trainJobCanceled: string;
  trainJobsHistoryTitle: string;
  trainJobsHistorySubtitle: string;
  trainClearFinishedBtn: string;
  trainClearFinishedTooltip: (count: number) => string;
  trainClearFilteredBtn: (filter: string) => string;
  trainClearFilteredTooltip: (count: number, filter: string) => string;
  trainClearFilteredDialogTitle: (filter: string) => string;
  trainClearFilteredDialogSubtitle: (count: number, filter: string) => string;
  trainClearFilteredDialogDesc: (filter: string) => string;
  trainClearFilteredConfirmBtn: (filter: string) => string;
  trainRefreshBtn: string;
  trainRefreshTooltip: string;
  trainRefreshedToast: string;
  trainFilterAll: string;
  trainFilterRunning: string;
  trainFilterDone: string;
  trainFilterError: string;
  trainSearchPlaceholder: string;
  trainNoJobsMatchingFilter: string;
  trainNoJobsSubmittedYet: string;
  trainNoJobsMatchingFilterDesc: string;
  trainNoJobsSubmittedYetDesc: string;
  trainResetFilters: string;
  trainJobIdCopied: string;
  trainJobDeletedToast: string;
  trainNoFinishedJobsToClear: string;
  trainJobsClearedToast: (count: number) => string;
  trainTrainingSucceeded: string;
  trainViewMetrics: string;
  trainOpenInPlayer: string;
  trainViewSteps: string;
  trainHideSteps: string;
  trainCancelJob: string;
  trainDeleteDialogTitle: string;
  trainDeleteDialogDesc: string;
  trainDeleteConfirmBtn: string;
  trainDeletingBtn: string;
  trainCancelBtn: string;
  trainClearDialogTitle: string;
  trainClearDialogSubtitle: (count: number) => string;
  trainClearDialogDesc: string;
  trainClearConfirmBtn: string;
  trainClearingBtn: string;
  trainMethodologyModalTitle: string;
  trainCloseModal: string;
  trainExecutionError: string;
  trainTabProgress: string;
  trainTabConfig: string;
  trainCardDataset: string;
  trainCardImputation: string;
  trainCardArchitecture: string;
  trainCardPfvi: string;
  trainJobCompleted: string;
  stepperStagePrefix: string;
  stepperStageProcessing: string;
  stepperStatusCompleted: string;
  stepperStatusFailed: string;
  stepperBackToLive: string;
  stepperDoneCount: (done: number, total: number) => string;
  stepperStatusQueued: string;
  sidebarThemeLight: string;
  sidebarThemeDark: string;
  sidebarThemeLightLabel: string;
  sidebarThemeDarkLabel: string;
  sidebarPressG: string;
  sidebarPressQuestion: string;
  runsEmptyFeatureCompare: string;
  runsEmptyFeatureTrajectory: string;
  runsEmptyFeatureSim: string;
  runsReconfigureInitiated: (jobId: string) => string;
  runsExportMlflowPickerTitle: string;
  runsExportOnnxPickerTitle: string;
  // Runs & Models (RunsPage)
  runsListTitle: string;
  runsAllDatasets: string;
  runsSearchPlaceholder: string;
  runsImportBtn: string;
  runsSelectedForCompare: (count: number) => string;
  runsResetCompare: string;
  runsNoRunsFound: string;
  runsRemoveFromCompareTooltip: string;
  runsSelectToCompareTooltip: string;
  runsComparisonTitle: (count: number) => string;
  runsComparisonSubtitle: string;
  runsDatasetsDiffer: string;
  runsClearComparison: string;
  runsComparativeCardsTitle: string;
  runsScrollHorizontalHint: string;
  runsBestModelBadge: string;
  runsModelNumberBadge: (num: number) => string;
  runsMultiModelTrajectoryTitle: string;
  runsMetricMatrixTitle: string;
  runsMetricOrParam: string;
  runsLowerIsBetter: string;
  runsFastestBadge: string;
  runsBestBadge: string;
  runsNoMetricHistoryTitle: string;
  runsNoMetricHistoryDesc: string;
  runsEmptyHeroBadge: string;
  runsEmptyHeroTitle: string;
  runsEmptyHeroDesc: string;
  runsEmptyStartTraining: string;
  runsEmptyImportRun: string;
  runsEmptyManageDatasets: string;
  runsEmptyFormatsNote: string;
  runsEmptyFeat1Title: string;
  runsEmptyFeat1Desc: string;
  runsEmptyFeat1Tags: string[];
  runsEmptyFeat2Title: string;
  runsEmptyFeat2Desc: string;
  runsEmptyFeat2Tags: string[];
  runsEmptyFeat3Title: string;
  runsEmptyFeat3Desc: string;
  runsEmptyFeat3Tags: string[];
  runsEmptyWorkflowTitle: string;
  runsEmptyWorkflowSubtitle: string;
  runsEmptyStep1Title: string;
  runsEmptyStep1Desc: string;
  runsEmptyStep1Btn: string;
  runsEmptyStep2Title: string;
  runsEmptyStep2Desc: string;
  runsEmptyStep2Btn: string;
  runsEmptyStep3Title: string;
  runsEmptyStep3Desc: string;
  runsEmptyStep3Btn: string;
  runsEmptySamplePreviewBadge: string;
  runsEmptySamplePreviewNotice: string;
  runsEmptySampleRunName: string;
  runsEmptySampleRunStatus: string;
  runsEmptySampleRunId: string;
  runsEmptySampleMetric1Label: string;
  runsEmptySampleMetric1Desc: string;
  runsEmptySampleMetric2Label: string;
  runsEmptySampleMetric2Desc: string;
  runsEmptySampleMetric3Label: string;
  runsEmptySampleMetric3Desc: string;
  runsEmptySampleMetric4Label: string;
  runsEmptySampleMetric4Desc: string;
  runsEmptySampleChartTitle: string;
  runsEmptySampleChartSubtitle: string;
  runsEmptySampleReadyTitle: string;
  runsEmptySampleReadyBtn: string;
  runsSidebarEmptyTitle: string;
  runsSidebarEmptyDesc: string;
  runsSidebarEmptyAction: string;
  runsSidebarSampleTitle: string;
  runsSidebarNoFilterMatch: string;
  runsSidebarResetFilter: string;
  runsNoRunsFilterDesc: (query: string) => string;
  runsGoToTraining: string;
  runsImportRun: string;
  runsLoadIntoPlayer: string;
  runsDeleteBtn: string;
  runsTrainingResultTitle: string;
  runsFitCompletedBadge: string;
  runsRiskClassLabel: string;
  runsPfviOptimizationMse: string;
  runsNelderMeadMinObjective: string;
  runsOptimizerTimeSteps: string;
  runsSimplexEvals: (count: string | number) => string;
  runsWtForecastMse: string;
  runsSmForecastMse: string;
  runsRfForecastMse: string;
  runsTempForecastMse: string;
  runsAllVariablesEvalTitle: string;
  runsAllVariablesEvalSubtitle: string;
  runsConfigPanelTitle: string;
  runsConfigDataset: string;
  runsConfigImputation: string;
  runsConfigForecasting: string;
  runsConfigPfvi: string;
  runsProgressTrendTitle: string;
  runsProgressTrendSubtitle: string;
  runsTrendLossVsEpoch: string;
  runsTrendSimplexConvergence: string;
  runsPfviCalibrationError: string;
  runsRmseLabel: string;
  runsExecutionDevice: string;
  runsGpuAcceleration: string;
  runsCpuExecution: string;
  runsGpuActiveDesc: string;
  runsCpuActiveDesc: string;
  runsOptimal: string;
  runsTarget: string;
  runsChannelLabel: string;
  runsHoldoutSplitBadge: (pct: number) => string;
  runsTestedChannelsOptimal: string;
  runsOutOfSampleSplit: (pct: number) => string;
  runsRmseTargetNotice: string;
  runsPipelineTotalTime: string;
  runsPipelineThroughput: (evals: number) => string;
  runsPipelineConverged: string;
  runsConfigHoldoutRatio: string;
  runsConfigHorizonSteps: (h: number) => string;
  runsConfigPrngSeed: (seed: number) => string;
  runsConfigImputerMethod: string;
  runsConfigNeighbors: (k: string | number) => string;
  runsConfigSmoothingSpan: (span: string | number) => string;
  runsConfigEdgeNaProtection: string;
  runsConfigForecastingModel: string;
  runsConfigStatistical: string;
  runsConfigNeural: string;
  runsConfigLookbackWindow: (l: string | number) => string;
  runsConfigHiddenUnits: (units: string | number) => string;
  runsConfigTotalEpochs: (ep: string | number) => string;
  runsConfigBatchOptimizer: (batch: string | number, lr?: string | number) => string;
  runsConfigLearningRate: (lr: string | number) => string;
  runsReconfigureBtn: string;
  runsReconfigureModalTitle: string;
  runsReconfigureModalDesc: string;
  runsReconfigureLaunch: string;
  runsReconfigureOpenTrain: string;
  runsLearningRateCol: string;
  runsConfigObjectiveFunction: string;
  runsConfigHydroConstants: (r0: string | number, dt: string | number) => string;
  runsConfigPeatProperties: (fc: string | number, sat: string | number) => string;
  runsTabImputeLabel: string;
  runsTabForecastLabel: string;
  runsTabPfviLabel: string;
  runsTabMetricsLabel: string;
  runsImputeCompletenessTitle: string;
  runsImputeCompletenessSubtitle: string;
  runsImputeRealObs: (pct: string) => string;
  runsImputeGapsFixed: (pct: string) => string;
  runsImputeNoGaps: string;
  runsTransferFunctionTitle: string;
  runsTransferFunctionSubtitle: string;
  runsParamAhDesc: string;
  runsParamBhDesc: string;
  runsParamNDesc: string;
  runsParamAlphaDesc: string;
  runsSystemOfRecord: string;
  runsAllFilterChip: (count: number) => string;
  runsTrendConverged: string;
  runsTrendSimplexEvalsCount: (count: number) => string;
  runsTrendEpochsCount: (count: number) => string;
  runsTrendSimplexTooltipTitle: (step: number, total: number) => string;
  runsTrendEpochTooltipTitle: (epoch: number, total: number) => string;
  runsTrendSimplexObjective: string;
  runsEmptyMainFeaturesTitle: string;
  runsEmptyStepNumber: (step: number) => string;
  runsEmptyAutoLogged: string;
  runsEmptyHorizonDays: (h: number) => string;
  runsEmptySamplePfviIndex: (idx: number) => string;
  runsEmptyDangerThreshold: string;
  runsFittedParams: string;
  runsSingleTrajectoryTitle: string;
  runsSingleTrajectorySubtitle: (h: number) => string;
  runsHoldoutRmseBenchmark: string;
  runsStageRuntimeBreakdown: string;
  runsStageTabImpute: string;
  runsStageTabForecast: string;
  runsStageTabPfvi: string;
  runsStageTabAllMetrics: string;
  runsImputeSummaryTitle: string;
  runsAlgorithmLabel: string;
  runsTotalImputedCells: string;
  runsImputedFraction: string;
  runsFlagsInvariants: string;
  runsMultivariateForecastTitle: (algo: string) => string;
  runsPfviCalibrationMetricsTitle: string;
  runsAllLoggedMetricsTitle: (count: number) => string;
  runsFilterMetricsPlaceholder: string;
  runsDeleteDialogTitle: string;
  runsDeleteDialogWarning: string;
  runsDeleteDialogDesc: string;
  runsDeleteCancel: string;
  runsDeletePermanent: string;
  runsDeleting: string;
  runsImportSuccessToast: (name: string, frames: number) => string;
  runsDeletedToast: string;
  runsCopiedClipboard: string;
  runsExportMlflowBtn: string;
  runsExportMlflowSuccess: (path: string) => string;
  runsExportingMlflow: string;
  runsLaunchCommandCopied: string;
  runsExportOnnxBtn: string;
  runsExportOnnxSuccess: (path: string) => string;
  runsExportingOnnx: string;
  runsOnnxCommandCopied: string;

  // Simulation Player (PlayerPage)
  playerTitle: string;
  playerPlaybookBtn: string;
  playerPlaybookTitle: string;
  playerPlaybookSubtitle: (hazardClass: string, pfvi: number) => string;
  playbookUrgencyRoutine: string;
  playbookUrgencyAdvisory: string;
  playbookUrgencyUrgent: string;
  playbookUrgencyEmergency: string;
  playbookFieldProtocols: string;
  playbookTimingLabel: string;
  playbookAuthorityLabel: string;
  playerTrendMode: string;
  player3dMode: string;
  playerImportBtn: string;
  playerExportBtn: string;
  playerExportCsv: string;
  playerDownloadJson: string;
  playerNoSimulationTitle: string;
  playerNoSimulationDesc: string;
  playerGoToTraining: string;
  playerImportRun: string;
  playerSelectFromRuns: string;
  playerEnvVariablesTitle: string;
  playerImputedToggle: string;
  playerDividerToggle: string;
  playerHoldoutToggle: string;
  playerZeroGuideToggle: string;
  playerHeroTitle: string;
  playerHeroFixedScale: string;
  playerMinimapTitle: string;
  playerMinimapDragHint: string;
  playerModelDetailsTitle: string;
  playerCloseBtn: string;
  playerExportSuccess: (name: string) => string;
  playerDownloadStarted: (name: string) => string;
  playerImportSuccess: (name: string, frames: number) => string;
  playerPlayBtn: string;
  playerPauseBtn: string;
  playerFcStartBtn: string;

  // Dataset Library (DataPage)
  dataLibraryTitle: string;
  dataImportFile: string;
  dataNoDatasetsTitle: string;
  dataNoDatasetsDesc: string;
  dataImportNewBtn: string;
  dataRenameTooltip: string;
  dataDeleteTooltip: string;
  dataRowsCount: (count: number) => string;
  dataRunsCount: (count: number) => string;
  dataEmptyExploreTitle: string;
  dataEmptyExploreDesc: string;
  dataTrainCta: string;
  dataKpiRows: string;
  dataKpiSeriesLabel: string;
  dataKpiSeriesValue: string;
  dataKpiMissingLabel: string;
  dataKpiMissingCells: (count: number, pct: string) => string;
  dataKpiTimelineLabel: string;
  dataKpiModelsLabel: string;
  dataKpiModelsTrained: (count: number) => string;
  dataTabStats: string;
  dataTabSeries: string;
  dataTabDecomp: string;
  dataTabAcf: string;
  dataTabMissing: string;
  dataTabTable: string;
  dataAllVariables: string;
  dataClickToEnlarge: string;
  dataStlAvailableTeaser: (period: number) => string;
  dataStlMethodGuide: string;
  dataStlOpenGuideTooltip: string;
  dataStlMethodLabel: string;
  dataStlTrend: string;
  dataStlPeriodLabel: string;
  dataStlAutoTooltip: string;
  dataTrendStrength: string;
  dataSeasonalStrength: string;
  dataDeleteModalTitle: string;
  dataDeleteModalWarning: string;
  dataDeleteLinkedNotice: string;
  dataDeleteCancel: string;
  dataDeleteConfirm: string;
  dataNewImportedSuccess: string;
  dataNameUpdated: (name: string) => string;
  dataDeletedSuccess: (name: string) => string;

  // Onboarding & Getting Started (OnboardingPage)
  onboardingHeroTitle: string;
  onboardingHeroSubtitle: string;
  onboardingBadgeWaterSoil: string;
  onboardingBadgeRainWeather: string;
  onboardingBadgeEarlyDetection: string;
  onboardingUploadBtn: string;
  onboardingGoToDataBtn: string;
  onboardingDatasetImported: string;
  onboardingProceedToTraining: string;
  onboardingWorkflowTitle: string;
  onboardingWorkflowSubtitle: string;
  onboardingOpenStage: string;
  onboardingModalTitle: string;
  onboardingModalSubtitle: string;
  onboardingDropzonePrompt: string;
  onboardingDropzoneDrop: string;
  onboardingDropzoneInspecting: string;
  onboardingDropzoneFormats: string;
  onboardingDropzoneMapperHint: string;
  onboardingUnsupportedFormat: string;
  onboardingCancel: string;
  onboardingSuccessToast: string;
}

export const catalogs: Record<Lang, I18nCatalog> = {
  id: {
    appTitle: "pfrsim",
    appSubtitle: "Simulator Risiko Kebakaran Lahan Gambut Tropis",
    overviewSection: "Ikhtisar & Panduan",
    pipelineSection: "Pipeline Pemodelan",
    onboardingTab: "Panduan Mulai",
    decideTab: "Ringkasan Risiko",
    dataTab: "Koleksi Data",
    trainTab: "Pelatihan Model",
    playerTab: "Simulasi Risiko",
    runsTab: "Riwayat & Model",
    glossaryButton: "Glosarium Istilah",
    shortcutsButton: "Pintasan Keyboard",
    referenceSection: "Bantuan & Referensi",
    sidebarClickHint: "Klik: buka di tab aktif, Ctrl+Klik: tab baru",
    openInNewTab: (name) => `Buka ${name} di tab baru`,

    closeAllTabs: "Tutup Semua Tab",
    closeAllTooltip: "Tutup semua tab (Reset ke Panduan Mulai)",
    closeTab: "Tutup Tab",
    closeCurrentTab: "Tutup Tab Saat Ini",
    closeOtherTabs: "Tutup Tab Lainnya",
    newTab: "Tab Baru",
    newTabTooltip: "Tab Baru (Panduan Mulai)",
    openTabsTitle: "Tab Terbuka",
    clickToSwitch: "Klik untuk beralih",
    searchTabsPlaceholder: "Cari tab...",
    overflowBadge: "meluap",

    decideHeadlineTitle: "Ringkasan Risiko Kebakaran",
    decideHorizonPrefix: "Prakiraan untuk cakrawala:",
    decideFreshnessPrefix: "Berdasarkan data observasi hingga:",
    decideStationPrefix: "Stasiun / Lokasi Pantau:",
    decideDriversTitle: "Faktor Pendorong Utama",
    decideDriversSubtitle: "Analisis kondisi hidrologis dan meteorologis di lapangan",
    decideConfidenceTitle: "Keandalan Data & Catatan Metodologi",
    decideConfidenceSubtitle: "Transparansi metode imputasi dan batasan data",
    decideActionsTitle: "Rekomendasi Tindakan Lapangan",
    decideActionsSubtitle: "Panduan operasional tanggap darurat dan tata kelola air gambut",
    decideNextStepsTitle: "Langkah Tindak Lanjut",
    decideSeePlayer: "Inspeksi di Garis Waktu Simulasi",
    decideCompareRuns: "Bandingkan Metrik Model",
    decideExportReport: "Ekspor Laporan Situasi",
    decideEmptyTitle: "Belum Ada Model yang Dilatih",
    decideEmptyDesc:
      "Impor dataset CSV/Excel Anda atau gunakan data sampel Sabangau untuk melihat evaluasi risiko otomatis.",
    decideEmptyCta: "Muat Data Sampel Sabangau (1-Klik)",

    caveatEstimatedData: (c) =>
      `${c} titik pengamatan harian merupakan estimasi (imputasi), bukan hasil pengukuran sensor langsung.`,
    caveatMethodAutomatic:
      "Metode prakiraan: Deret waktu adaptif otomatis (AutoARIMA + Transformasi Box-Cox).",
    caveatAgreement: (cls) => `Dua metode pemodelan sepakat pada kategori tingkat risiko: ${cls}.`,
    caveatGridTruncated:
      "Pencarian grid parameter dioptimalkan untuk menjamin responsivitas real-time.",
    caveatEdgeNa: "Terdapat data hilang pada batas awal atau akhir periode pengamatan.",
    caveatUnboundedSm:
      "Prakiraan kelembapan tanah mengindikasikan kekeringan kritis pada lapisan atas gambut.",
    caveatHighConfidence: "Kelengkapan data observasi sangat tinggi dengan deviasi sensor minimal.",

    classLow: "Rendah (Aman)",
    classModerate: "Sedang (Waspada)",
    classHigh: "Tinggi (Siaga)",
    classExtreme: "Ekstrem (Awas Bahaya)",

    glossaryTitle: "Glosarium & Panduan Parameter",
    glossaryClose: "Tutup Glosarium",
    glossaryWtTitle: "Water Table / Tinggi Muka Air Gambut (WT)",
    glossaryWtDesc:
      "Kedalaman muka air di bawah permukaan tanah gambut dalam meter (nilai negatif). Kedalaman air di bawah -0.4 m mengeringkan lapisan gambut atas dan meningkatkan risiko penyalaan api bawah tanah.",
    glossarySmTitle: "Soil Moisture / Kelembapan Tanah Gambut (SM)",
    glossarySmDesc:
      "Kadar air volumetrik dalam pori-pori lapisan gambut atas (persentase %). Nilai di bawah 30-35% menandakan bahan bakar gambut siap menyala dan sulit dipadamkan.",
    glossaryRfTitle: "Rainfall / Curah Hujan (Rf)",
    glossaryRfDesc:
      "Akumulasi curah hujan harian dari stasiun cuaca dalam milimeter (mm). Hujan kumulatif di atas 5 mm membasahi serasah permukaan dan memutus rantai penjalaran api.",
    glossaryTempTitle: "Air Temperature / Suhu Ambien Udara (Temp)",
    glossaryTempDesc:
      "Suhu udara rata-rata harian dalam derajat Celsius (°C). Suhu tinggi memicu laju evapotranspirasi yang mempercepat pengeringan gambut.",
    glossaryPfviTitle: "Peat Fire Vulnerability Index (PFVI)",
    glossaryPfviDesc:
      "Indeks kerentanan kebakaran lahan gambut terintegrasi (skala 0 - 300). Dihitung dari interaksi non-linear antara fluktuasi muka air tanah, kekeringan tanah, dan dinamika cuaca.",
    glossaryClassesTitle: "Kategori Tingkat Bahaya PFVI",
    glossaryClassesDesc:
      "0–75: Rendah (gambut basah/aman), 76–150: Sedang (waspada kekeringan), 151–225: Tinggi (siaga kebakaran aktif), 226–300: Ekstrem (bahaya kebakaran besar meluas).",

    trainTitle: "Konfigurasi Pelatihan Model",
    trainSubtitle: "Atur imputasi data, prakiraan multi-langkah, dan kalibrasi PFVI",
    trainMathDocs: "Metodologi",
    trainMathDocsTooltip: "Lihat Formulasi Matematika",
    trainResizeHint: "Tarik untuk mengubah lebar panel konfigurasi (Klik ganda untuk reset)",
    trainPresetsTitle: "Preset Konfigurasi Cepat",
    trainCustomModified: "Kustom Dimodifikasi",
    trainPresetApplied: (name) => `Preset diterapkan: ${name}`,
    trainTargetDataset: "Dataset Target",
    trainDatasetsLoaded: (count) => `${count} dimuat`,
    trainNoDatasetPlaceholder: "-- Belum ada data, muat sampel terlebih dahulu --",
    trainNoDatasetEmptyText: "Belum ada dataset yang dimuat",
    trainNoDatasetWarningTitle: "Belum Ada Dataset Target",
    trainNoDatasetWarningDesc: "Impor data CSV/Parquet di halaman Data atau Onboarding.",
    trainGoToData: "Buka Data",
    trainTotalTimesteps: "Total Langkah Waktu",
    trainRows: "baris",
    trainMissingGaps: "Celah Data Hilang",
    trainPastRuns: (count) => `${count} riwayat pelatihan model`,
    trainInspectInData: "Periksa di Menu Data",
    trainImputationTitle: "Algoritma Imputasi",
    trainImputationInfoTitle: "Tahap Imputasi Nilai Hilang",
    trainImputationInfoDesc:
      "Sensor lahan gambut sering mengalami celah data akibat kendala transmisi atau daya. Algoritma imputasi mengisi celah sebelum peramalan deret waktu.",
    trainImputationKnnDesc: "Mengisi celah data berdasarkan kesamaan pola dari 4 sensor.",
    trainImputationLinearDesc: "Interpolasi garis lurus antar titik yang cepat dan sederhana.",
    trainImputationSplineDesc: "Interpolasi kurva halus kontinu untuk fluktuasi alami.",
    trainImputationLoessDesc: "Penghalusan regresi lokal adaptif terhadap tren non-linier.",
    trainImputationKnnParam: "k-Nearest Neighbors (k):",
    trainImputationKnnHint: "Jumlah observasi donor dalam ruang 4D Euclidean (WT, SM, Rf, Temp).",
    trainImputationLoessParam: "Rentang penghalusan (α):",
    trainImputationLoessHint:
      "Proporsi titik data di lingkungan lokal untuk regresi tricube berbobot.",
    trainImputationLinearBanner:
      "Interpolasi linier cepat antar batas celah data. Sangat cepat dan menjaga kontinuitas dasar.",
    trainImputationSplineBanner:
      "Interpolasi kurva spline kubik yang halus. Menghasilkan transisi data yang lembut dan mulus.",
    trainForecasterTitle: "Algoritma Prakiraan",
    trainForecasterInfoTitle: "Algoritma Prakiraan Multi-Langkah",
    trainForecasterInfoDesc:
      "Prakiraan memproyeksikan kondisi gambut (WT, SM, Curah Hujan, Suhu) h langkah ke depan sebelum perhitungan kerentanan kebakaran.",
    trainForecasterArimaBadge: "Statistik Klasik",
    trainForecasterArimaDesc:
      "Model statistik otomatis yang cepat dan andal untuk menangkap pola tren musiman.",
    trainForecasterLstmBadge: "Jaringan Saraf",
    trainForecasterLstmDesc:
      "Jaringan saraf tiruan untuk memodelkan dinamika kompleks dan ketergantungan jangka panjang.",
    trainForecasterGruBadge: "Efisien & Cepat",
    trainForecasterGruDesc:
      "Jaringan saraf efisien yang berlatih lebih cepat untuk mempelajari tren fluktuasi gambut.",
    trainForecasterDefaultDesc: "Prakiraan deret waktu multivariat.",
    trainSplitRatioParam: "Rasio pemisahan evaluasi holdout:",
    trainSplitRatioHint:
      "Membagi deret menjadi pelatihan vs evaluasi holdout. Mengestimasi Box-Cox profil λ, ordo (p,d,q), dan menghitung RMSE out-of-sample serta uji Ljung-Box.",
    trainDlArch: (name) => `Arsitektur Jaringan Saraf ${name}`,
    trainDlDeviceCpu: "CPU",
    trainDlDeviceGpu: "GPU",
    trainDlLookback: "Lookback:",
    trainDlEpochs: "Epochs:",
    trainDlUnits: "Unit (d):",
    trainDlBatchSize: "Batch Size (B):",
    trainDlFullBatch: "Full Batch",
    trainDlFullBatchDesc:
      "Pelatihan full batch tanpa pemotongan mini-batch (seluruh N_train dievaluasi per epoch).",
    trainDlLearningRate: "Learning Rate (η):",
    trainDlLearningRateHint: "Laju pembaruan bobot pengoptimal Adam (biasanya 0.001 - 0.05).",
    trainDlGuideTitle: "Panduan Praktik Terbaik Hiperparameter Deep Learning",
    trainDlGuideLookbackTitle: "Jendela Riwayat / Lookback (L)",
    trainDlGuideLookbackDesc:
      "Jumlah langkah mundur waktu untuk memprediksi horizon ke depan. Nilai 12 optimal untuk data bulanan (siklus tahunan), atau 7–14 untuk data harian. Nilai >30 meningkatkan latensi tanpa menambah akurasi.",
    trainDlGuideEpochsTitle: "Epoch Pelatihan (E)",
    trainDlGuideEpochsDesc:
      "Iterasi pelatihan penuh atas dataset. Nilai 50–150 biasanya cukup; model LSTM/GRU dengan Adam umumnya mencapai konvergensi stabil pada 60–80 epoch.",
    trainDlGuideUnitsTitle: "Unit Tersembunyi / Hidden Units (d)",
    trainDlGuideUnitsDesc:
      "Dimensi vektor keadaan rekuren. 16 unit memberikan regularisasi optimal tanpa menghafal noise sensor; 32–64 unit cocok untuk pola non-linier kompleks lintas musim.",
    trainDlGuideBatchTitle: "Ukuran Batch (B) & Full Batch",
    trainDlGuideBatchDesc:
      "Mini-batch (32–128) memaksimalkan akselerasi GPU dan memberikan stochastic noise yang membantu keluar dari saddle point. Full Batch (0) menghitung gradien eksak atas seluruh data per epoch, ideal untuk stabilitas deterministik CPU.",
    trainDlGuideLrTitle: "Tingkat Pembelajaran / Learning Rate (η)",
    trainDlGuideLrDesc:
      "Ukuran langkah pengoptimal Adam. Nilai standar 0.01–0.02 pada data ternormalisasi [0, 1]. Turunkan ke 0.005 atau 0.001 jika loss berosilasi.",
    trainDlGuideHardwareTitle: "Akselerasi Perangkat Keras",
    trainDlGuideHardwareDesc:
      "GPU (wgpu) memberikan akselerasi hingga 5x–8x saat batch size >=64. CPU multi-threaded (Rayon) efisien untuk batch kecil atau Full Batch.",
    trainDlBatchFit: (backend, range) => `Kapasitas optimal batch ${backend}: ${range}`,
    trainDlGpuActive: (name, backend) => `Akselerasi perangkat keras aktif (${name} · ${backend}).`,
    trainDlGpuRequested:
      "Mode GPU diminta (otomatis beralih ke tensor CPU jika perangkat tidak tersedia).",
    trainDlCpuActive: "Eksekusi tensor CPU multi-threaded teroptimasi (Rayon & SIMD).",
    trainDlGpuUnavailable: "GPU tidak tersedia",
    trainGpuAccel: "Akselerasi GPU",
    trainGpuScore: (score) => `Skor: ${score}/100`,
    trainGpuDefaultName: "Hardware GPU",
    trainGpuDefaultTier: "GPU Terakselerasi Perangkat Keras",
    trainGpuNoGpu: "GPU Tidak Terdeteksi",
    trainGpuBenchmarkScore: "Skor Tolok Ukur Komputasi",
    trainGpuVram: "Memori (VRAM)",
    trainGpuEstSpeedup: "Est. Peningkatan Kecepatan",
    trainGpuDriver: (driver) => `Driver: ${driver}`,
    trainGpuHardwareLayer: "Lapisan Perangkat Keras",
    trainPfviSettingsTitle: "Pengaturan PFVI & Nelder-Mead",
    trainPfviInfoTitle: "Optimasi Indeks PFVI",
    trainPfviInfoDesc:
      "Parameter Nelder-Mead mengkalibrasi fungsi kerentanan kebakaran gambut terhadap indeks kekeringan terobservasi (DIobs).",
    trainPfviHorizonParam: "Cakrawala / Horizon (langkah h):",
    trainPfviAnnualRainParam: "Hujan Tahunan R0:",
    trainPfviMaxGridParam: "Grid Maksimal (m):",
    trainPfviRandomSeed: "Seed Acak:",
    trainPfviRandomBtn: "Acak",
    trainStartBtn: "Mulai Pelatihan Model",
    trainStartingBtn: "Memulai Tugas Pipeline...",
    trainPleaseSelectDataset: "Pilih dataset terlebih dahulu.",
    trainJobQueuedSuccess: "Pelatihan model berhasil dimulai!",
    trainJobCanceled: "Pekerjaan pelatihan dibatalkan",
    trainJobsHistoryTitle: "Riwayat Tugas Pelatihan",
    trainJobsHistorySubtitle:
      "Pelacakan proses latar belakang secara real-time dan eksekusi bertahap",
    trainClearFinishedBtn: "Bersihkan Selesai",
    trainClearFinishedTooltip: (count) => `Bersihkan ${count} tugas selesai dari daftar`,
    trainClearFilteredBtn: (filter) => {
      switch (filter) {
        case "running":
          return "Batalkan & Hapus";
        case "done":
          return "Bersihkan Selesai";
        case "error":
          return "Bersihkan Gagal";
        default:
          return "Hapus Semua";
      }
    },
    trainClearFilteredTooltip: (count, filter) => `Hapus ${count} tugas (${filter}) dari daftar`,
    trainClearFilteredDialogTitle: (filter) => {
      switch (filter) {
        case "running":
          return "Batalkan & Hapus Tugas Berjalan?";
        case "done":
          return "Bersihkan Riwayat Tugas Selesai?";
        case "error":
          return "Bersihkan Riwayat Tugas Gagal?";
        default:
          return "Hapus Semua Tugas Terfilter?";
      }
    },
    trainClearFilteredDialogSubtitle: (count, filter) =>
      `${count} tugas (${filter}) akan dihapus dari daftar`,
    trainClearFilteredDialogDesc: (filter) => {
      switch (filter) {
        case "running":
          return "Semua tugas yang sedang berjalan atau antre akan dibatalkan seketika dan dihapus dari antrean pengawas latar belakang.";
        case "done":
          return "Semua riwayat tugas selesai akan dihapus dari daftar pengawas. Model dan artefak hasil pelatihan yang tersimpan di SQLite tetap aman.";
        case "error":
          return "Semua riwayat tugas yang mengalami galat akan dibersihkan dari daftar.";
        default:
          return "Semua tugas yang cocok dengan filter saat ini akan dihapus dari riwayat pengawas. Jika ada tugas yang sedang berjalan, prosesnya akan dibatalkan terlebih dahulu.";
      }
    },
    trainClearFilteredConfirmBtn: (filter) =>
      filter === "running" ? "Ya, Batalkan & Hapus" : "Ya, Hapus",
    trainRefreshBtn: "Perbarui",
    trainRefreshTooltip: "Perbarui daftar tugas dan dataset",
    trainRefreshedToast: "Daftar tugas & dataset diperbarui.",
    trainFilterAll: "Semua",
    trainFilterRunning: "Berjalan",
    trainFilterDone: "Selesai",
    trainFilterError: "Error",
    trainSearchPlaceholder: "Cari ID tugas, dataset...",
    trainNoJobsMatchingFilter: "Tidak ada tugas sesuai filter",
    trainNoJobsSubmittedYet: "Belum ada riwayat tugas pelatihan",
    trainNoJobsMatchingFilterDesc: "Ubah kata kunci pencarian atau reset tab status.",
    trainNoJobsSubmittedYetDesc:
      "Pilih dataset target di panel kiri, tentukan algoritma, lalu klik 'Mulai Pelatihan Model'.",
    trainResetFilters: "Reset Filter",
    trainJobIdCopied: "ID tugas disalin!",
    trainJobDeletedToast: "Tugas pelatihan berhasil dihapus.",
    trainNoFinishedJobsToClear: "Tidak ada tugas selesai untuk dibersihkan.",
    trainJobsClearedToast: (count) => `${count} riwayat tugas selesai telah dibersihkan.`,
    trainTrainingSucceeded: "Pelatihan Selesai",
    trainViewMetrics: "Lihat Metrik",
    trainOpenInPlayer: "Buka di Player",
    trainViewSteps: "Lihat Tahapan",
    trainHideSteps: "Sembunyikan Tahapan",
    trainCancelJob: "Batal",
    trainDeleteDialogTitle: "Hapus Riwayat Tugas?",
    trainDeleteDialogDesc: "Tindakan ini menghapus catatan tugas dari riwayat.",
    trainDeleteConfirmBtn: "Hapus",
    trainDeletingBtn: "Menghapus...",
    trainCancelBtn: "Batal",
    trainClearDialogTitle: "Bersihkan Riwayat Tugas Selesai?",
    trainClearDialogSubtitle: (count) => `${count} tugas selesai/gagal akan dihapus`,
    trainClearDialogDesc:
      "Semua riwayat tugas yang berstatus selesai atau gagal akan dihapus dari antrean pengawas latar belakang. Model dan artefak hasil pelatihan yang tersimpan di SQLite tidak akan terhapus.",
    trainClearConfirmBtn: "Ya, Bersihkan",
    trainClearingBtn: "Membersihkan...",
    trainMethodologyModalTitle: "Formulasi Matematika & Metodologi",
    trainCloseModal: "Tutup",
    trainExecutionError: "Kesalahan Eksekusi",
    trainTabProgress: "Progres Pelatihan",
    trainTabConfig: "Detail Konfigurasi",
    trainCardDataset: "Dataset & Evaluasi",
    trainCardImputation: "Konfigurasi Imputasi",
    trainCardArchitecture: "Arsitektur Model",
    trainCardPfvi: "Parameter Fisik PFVI",
    trainJobCompleted: "100% Selesai",
    stepperStagePrefix: "Tahap: ",
    stepperStageProcessing: "Memproses",
    stepperStatusCompleted: "Pelatihan Selesai",
    stepperStatusFailed: "Pelatihan Gagal",
    stepperBackToLive: "Kembali ke Live",
    stepperDoneCount: (done, total) => `${done} / ${total} Selesai`,
    stepperStatusQueued: "Menunggu",
    sidebarThemeLight: "Mode Terang",
    sidebarThemeDark: "Mode Gelap",
    sidebarThemeLightLabel: "Terang",
    sidebarThemeDarkLabel: "Gelap",
    sidebarPressG: "Tekan 'G'",
    sidebarPressQuestion: "Tekan '?'",
    runsEmptyFeatureCompare: "Komparasi Multi-Model",
    runsEmptyFeatureTrajectory: "Trajektori Risiko PFVI",
    runsEmptyFeatureSim: "Simulasi Spasial 2D & 3D",
    runsReconfigureInitiated: (jobId) => `Eksperimen baru dimulai (Job: ${jobId.slice(0, 8)}...)`,
    runsExportMlflowPickerTitle: "Pilih Folder untuk Ekspor MLflow",
    runsExportOnnxPickerTitle: "Pilih Folder untuk Ekspor ONNX",
    runsListTitle: "Daftar Model",
    runsAllDatasets: "Semua Dataset",
    runsSearchPlaceholder: "Cari run, ID, model...",
    runsImportBtn: "Impor Data Run (.json / .csv)",
    runsSelectedForCompare: (count) => `${count}/10 dipilih untuk perbandingan`,
    runsResetCompare: "Reset",
    runsNoRunsFound: "Tidak ada run yang cocok",
    runsRemoveFromCompareTooltip: "Batalkan perbandingan model ini",
    runsSelectToCompareTooltip: "Pilih untuk dibandingkan (maks 10)",
    runsComparisonTitle: (count) => `Perbandingan Model Head-to-Head (${count} Model Terpilih)`,
    runsComparisonSubtitle:
      "Bandingkan metrik akurasi holdout, waktu optimasi, dan kurva risiko horizon secara visual",
    runsDatasetsDiffer: "dataset berbeda",
    runsClearComparison: "Bersihkan Perbandingan",
    runsComparativeCardsTitle: "Kartu Ringkasan Komparatif",
    runsScrollHorizontalHint: "Geser horizontal untuk melihat seluruh model",
    runsBestModelBadge: "🏆 #1 Best Model",
    runsModelNumberBadge: (num) => `#${num} Model`,
    runsMultiModelTrajectoryTitle: "Perbandingan Kurva Risiko Kebakaran Multi-Model (PFVI Horizon)",
    runsMetricMatrixTitle: "Matriks Metrik Komparatif Terperinci",
    runsMetricOrParam: "Metrik / Parameter",
    runsLowerIsBetter: "(Lebih rendah lebih baik)",
    runsFastestBadge: "Tercepat",
    runsBestBadge: "Terbaik",
    runsNoMetricHistoryTitle: "Belum Ada Riwayat Metrik",
    runsNoMetricHistoryDesc:
      "Latih model di menu Pelatihan untuk mulai mencatat riwayat metrik kalibrasi ke SQLite.",
    runsEmptyHeroBadge: "REGISTRI MODEL",
    runsEmptyHeroTitle: "Belum Ada Riwayat Model",
    runsEmptyHeroDesc:
      "Latih model di menu Pelatihan untuk mulai mencatat riwayat metrik kalibrasi ke SQLite, atau impor berkas run yang sudah ada.",
    runsEmptyStartTraining: "Buka Pelatihan Model",
    runsEmptyImportRun: "Impor Data Run",
    runsEmptyManageDatasets: "Kelola Dataset",
    runsEmptyFormatsNote:
      "Mendukung artefak run PFRSim (.json) dan ringkasan metrik (.csv). Tersimpan aman di direktori lokal Anda.",
    runsEmptyFeat1Title: "Benchmark Multi-Model",
    runsEmptyFeat1Desc:
      "Centang 2 atau lebih model dari daftar untuk membandingkan metrik MSE kalibrasi, error holdout, dan durasi komputasi secara berdampingan.",
    runsEmptyFeat1Tags: ["Multi-Select", "Matriks Metrik", "Pareto-Optimal"],
    runsEmptyFeat2Title: "Trajektori Horizon PFVI",
    runsEmptyFeat2Desc:
      "Inspeksi kurva prakiraan risiko multi-langkah t = n+1 s/d t = n+h untuk kanal Water Table (WT) dan Soil Moisture (SM) lengkap dengan kategori bahaya.",
    runsEmptyFeat2Tags: ["Horizon h=1..30", "WT & SM Forecast", "5 Kategori Bahaya"],
    runsEmptyFeat3Title: "Integrasi Simulasi 2D & 3D",
    runsEmptyFeat3Desc:
      "Kirim model terbaik langsung ke antarmuka Player untuk mensimulasikan dinamika muka air tanah pada peta spasial 2D dan lanskap 3D gambut.",
    runsEmptyFeat3Tags: ["Spasial 2D", "Lanskap 3D Gambut", "Ekspor PNG & CSV"],
    runsEmptyWorkflowTitle: "Alur Kerja dari Nol ke Model Terlatih",
    runsEmptyWorkflowSubtitle:
      "Tiga langkah terstruktur untuk menghasilkan model kalibrasi risiko kebakaran gambut",
    runsEmptyStep1Title: "Siapkan Dataset Hidrologi",
    runsEmptyStep1Desc:
      "Pilih atau unggah data sensor gambut berisi tinggi muka air tanah (WT), kelembaban tanah (SM), dan curah hujan.",
    runsEmptyStep1Btn: "Buka Data",
    runsEmptyStep2Title: "Konfigurasi & Latih Model",
    runsEmptyStep2Desc:
      "Tentukan algoritma imputasi (KNN/Mean) dan peramalan (ARIMA/BiLSTM/Linear), lalu jalankan proses fitting.",
    runsEmptyStep2Btn: "Buka Pelatihan",
    runsEmptyStep3Title: "Evaluasi & Bandingkan",
    runsEmptyStep3Desc:
      "Hasil kalibrasi otomatis tercatat di sini. Analisis trajektori risiko, periksa akurasi RMSE, dan pilih model terbaik.",
    runsEmptyStep3Btn: "Pelajari Metrik",
    runsEmptySamplePreviewBadge: "PRATINJAU FORMAT METRIK MODEL",
    runsEmptySamplePreviewNotice:
      "Contoh metrik komparatif dan trajektori yang akan otomatis terisi setelah pelatihan model dijalankan:",
    runsEmptySampleRunName: "ARIMA(1,1,1) × KNN Imputer (Holdout 20%)",
    runsEmptySampleRunStatus: "FIT COMPLETED",
    runsEmptySampleRunId: "run_gambut_2026_arima_01",
    runsEmptySampleMetric1Label: "PFVI MSE (Kalibrasi)",
    runsEmptySampleMetric1Desc: "Nelder-Mead 142 evaluasi",
    runsEmptySampleMetric2Label: "WT Holdout RMSE",
    runsEmptySampleMetric2Desc: "Akurasi kanal tinggi (0.024 m)",
    runsEmptySampleMetric3Label: "Kategori Risiko (t=n+h)",
    runsEmptySampleMetric3Desc: "Siaga / Kategori 3 (Amber)",
    runsEmptySampleMetric4Label: "Waktu Pipeline",
    runsEmptySampleMetric4Desc: "KNN 12ms • ARIMA 214ms • PFVI 98ms",
    runsEmptySampleChartTitle: "Trajektori Prediksi Muka Air & Risiko (Horizon t=n+1 .. t=n+7)",
    runsEmptySampleChartSubtitle:
      "Simulasi proyeksi penurunan muka air tanah dan kenaikan indeks PFVI terhadap ambang batas bahaya",
    runsEmptySampleReadyTitle: "Siap melatih model pertama Anda?",
    runsEmptySampleReadyBtn: "Mulai Latih Model Sekarang",
    runsSidebarEmptyTitle: "Belum Ada Model Terlatih",
    runsSidebarEmptyDesc: "Hasil pelatihan model akan otomatis tersimpan di sini.",
    runsSidebarEmptyAction: "Mulai Pelatihan",
    runsSidebarSampleTitle: "Format Model Tersimpan",
    runsSidebarNoFilterMatch: "Tidak ada model yang cocok",
    runsSidebarResetFilter: "Reset Filter",
    runsNoRunsFilterDesc: (query: string) =>
      `Tidak ditemukan model yang cocok dengan kata kunci "${query}".`,
    runsGoToTraining: "Buka Pelatihan Model",
    runsImportRun: "Impor Data Run",
    runsLoadIntoPlayer: "Buka di Player",
    runsDeleteBtn: "Hapus",
    runsTrainingResultTitle: "Hasil Pelatihan Model (Training Result)",
    runsFitCompletedBadge: "✓ FIT COMPLETED",
    runsRiskClassLabel: "Kategori Risiko (t=n+h):",
    runsPfviOptimizationMse: "PFVI Optimization MSE",
    runsNelderMeadMinObjective: "Nelder-Mead min objective",
    runsOptimizerTimeSteps: "Waktu / Langkah Optimizer",
    runsSimplexEvals: (count) => `${count} evaluasi simpleks`,
    runsWtForecastMse: "WT Forecast Error (MSE)",
    runsSmForecastMse: "SM Forecast Error (MSE)",
    runsRfForecastMse: "Rf Forecast Error (MSE)",
    runsTempForecastMse: "Temp Forecast Error (MSE)",
    runsAllVariablesEvalTitle: "Evaluasi Metrik Seluruh Variabel (Holdout Evaluation)",
    runsAllVariablesEvalSubtitle:
      "Evaluasi akurasi peramalan multi-langkah (MSE, RMSE, MAE) pada subset pengujian holdout",
    runsConfigPanelTitle: "Konfigurasi & Hiperparameter Model",
    runsConfigDataset: "Dataset & Evaluasi",
    runsConfigImputation: "Konfigurasi Imputasi",
    runsConfigForecasting: "Arsitektur & Hiperparameter",
    runsConfigPfvi: "Parameter Fisik PFVI",
    runsProgressTrendTitle: "Trend Progres Pelatihan & Konvergensi",
    runsProgressTrendSubtitle:
      "Visualisasi penurunan error/loss terhadap epoch atau evaluasi simpleks Nelder-Mead",
    runsTrendLossVsEpoch: "Loss vs. Epoch (Peramalan)",
    runsTrendSimplexConvergence: "Konvergensi Simpleks Nelder-Mead",
    runsPfviCalibrationError: "Akurasi Kalibrasi PFVI",
    runsRmseLabel: "RMSE (Utama)",
    runsExecutionDevice: "Perangkat Komputasi",
    runsGpuAcceleration: "Akselerasi GPU",
    runsCpuExecution: "Eksekusi CPU",
    runsGpuActiveDesc: "Akselerasi Perangkat Keras Aktif",
    runsCpuActiveDesc: "Mesin Multi-Threading Host",
    runsOptimal: "Optimal",
    runsTarget: "Target",
    runsChannelLabel: "Kanal / Variabel",
    runsHoldoutSplitBadge: (pct) => `${pct}% Data Uji Holdout`,
    runsTestedChannelsOptimal: "4/4 Kanal Teruji Optimal",
    runsOutOfSampleSplit: (pct) => `Evaluasi: Out-of-sample ${pct}% split`,
    runsRmseTargetNotice: "Target: Nilai RMSE < ambang batas toleransi",
    runsPipelineTotalTime: "Total",
    runsPipelineThroughput: (evals) => `Throughput: ~${evals} evals/s`,
    runsPipelineConverged: "Konvergen",
    runsConfigHoldoutRatio: "Rasio Split Holdout:",
    runsConfigHorizonSteps: (h) => `${h} langkah / steps`,
    runsConfigPrngSeed: (seed) => `${seed} (Deterministik)`,
    runsConfigImputerMethod: "Metode Imputasi:",
    runsConfigNeighbors: (k) => `k = ${k}`,
    runsConfigSmoothingSpan: (span) => `span = ${span}`,
    runsConfigEdgeNaProtection: "✓ Perlindungan Batas Edge-NA",
    runsConfigForecastingModel: "Model Peramalan:",
    runsConfigStatistical: "Statistik",
    runsConfigNeural: "Jaringan Saraf",
    runsConfigLookbackWindow: (l) => `${l} langkah / timesteps`,
    runsConfigHiddenUnits: (units) => `${units} unit tersembunyi`,
    runsConfigTotalEpochs: (ep) => `${ep} epoch`,
    runsConfigBatchOptimizer: (batch, lr = 0.02) =>
      String(batch).toLowerCase() === "full" || String(batch) === "0"
        ? `Full Batch · Adam (lr=${lr})`
        : `Batch ${batch} · Adam (lr=${lr})`,
    runsConfigLearningRate: (lr) => `Learning Rate: η = ${lr}`,
    runsReconfigureBtn: "Konfigurasi & Re-run",
    runsReconfigureModalTitle: "Konfigurasi & Jalankan Ulang Model",
    runsReconfigureModalDesc:
      "Sesuaikan hiperparameter (seperti learning rate, epochs, dan ukuran batch) lalu luncurkan eksperimen baru.",
    runsReconfigureLaunch: "Luncurkan Eksperimen",
    runsReconfigureOpenTrain: "Buka di Studio Pelatihan",
    runsLearningRateCol: "Learning Rate (η)",
    runsConfigObjectiveFunction: "Fungsi Objektif:",
    runsConfigHydroConstants: (r0, dt) => `R0=${r0} mm · dt=${dt} hr`,
    runsConfigPeatProperties: (fc, sat) => `FC=${fc}% · SAT=${sat}%`,
    runsTabImputeLabel: "1. Imputasi Data",
    runsTabForecastLabel: "2. Model Prakiraan",
    runsTabPfviLabel: "3. Kalibrasi PFVI",
    runsTabMetricsLabel: "4. Registri Metrik MLflow",
    runsImputeCompletenessTitle: "Kelengkapan Data & Pemulihan Celah per Kanal",
    runsImputeCompletenessSubtitle: "Observasi Riil vs Terimputasi",
    runsImputeRealObs: (pct) => `${pct}% Riil`,
    runsImputeGapsFixed: (pct) => `${pct}% celah diperbaiki`,
    runsImputeNoGaps: "Data lengkap tanpa celah",
    runsTransferFunctionTitle: "Fungsi Transfer Fluktuasi Air Tanah Gambut (WTF)",
    runsTransferFunctionSubtitle: "Model retensi air tipe Van Genuchten",
    runsParamAhDesc: "aH (Skala Penurunan Muka Air)",
    runsParamBhDesc: "bH (Sensitivitas Kenaikan Air)",
    runsParamNDesc: "n (Eksponen Bentuk Lengkung)",
    runsParamAlphaDesc: "α (Skala Kapiler Gambut)",
    runsSystemOfRecord: "Metrik Kompatibel dengan MLflow",
    runsAllFilterChip: (count) => `Semua (${count})`,
    runsTrendConverged: "✓ Konvergen",
    runsTrendSimplexEvalsCount: (count) => `${count} Evaluasi`,
    runsTrendEpochsCount: (count) => `${count} Epoch`,
    runsTrendSimplexTooltipTitle: (step, total) => `Evaluasi Simpleks #${step} / ${total}`,
    runsTrendEpochTooltipTitle: (epoch, total) => `Epoch ${epoch} / ${total}`,
    runsTrendSimplexObjective: "Objektif RMSE:",
    runsEmptyMainFeaturesTitle: "Fitur Utama Workbench",
    runsEmptyStepNumber: (step) => `LANGKAH 0${step}`,
    runsEmptyAutoLogged: "Otomatis di SQLite",
    runsEmptyHorizonDays: (h) => `Horizon h=${h} hari`,
    runsEmptySamplePfviIndex: (idx) => `Indeks PFVI = ${idx}`,
    runsEmptyDangerThreshold: "Ambang Bahaya (PFVI > 60)",
    runsFittedParams: "Parameter Terkalibrasi:",
    runsSingleTrajectoryTitle: "Visualisasi Trajektori Risiko Kebakaran Horizon (PFVI)",
    runsSingleTrajectorySubtitle: (h) => `Prakiraan multi-langkah horizon t = n+1 s/d t = n+${h}`,
    runsHoldoutRmseBenchmark: "Akurasi Kanal (RMSE Evaluasi Holdout)",
    runsStageRuntimeBreakdown: "Waktu Eksekusi Tahapan Pipeline",
    runsStageTabImpute: "1. Imputasi",
    runsStageTabForecast: "2. Prakiraan",
    runsStageTabPfvi: "3. Kalibrasi PFVI",
    runsStageTabAllMetrics: "4. Semua Metrik (MLflow)",
    runsImputeSummaryTitle: "Ringkasan & Cakupan Imputasi",
    runsAlgorithmLabel: "Algoritma",
    runsTotalImputedCells: "Total Sel Terimputasi",
    runsImputedFraction: "Fraksi Imputasi",
    runsFlagsInvariants: "Status & Flags",
    runsMultivariateForecastTitle: (algo) => `Metrik Prakiraan Multivariat (${algo})`,
    runsPfviCalibrationMetricsTitle: "Metrik Kalibrasi PFVI Nelder-Mead",
    runsAllLoggedMetricsTitle: (count) => `Seluruh Metrik MLflow (${count} metrik tercatat)`,
    runsFilterMetricsPlaceholder: "Filter kunci metrik (misal: mse, rmse)...",
    runsDeleteDialogTitle: "Hapus Hasil Model / Run?",
    runsDeleteDialogWarning: "Tindakan ini tidak dapat dibatalkan.",
    runsDeleteDialogDesc:
      "Semua metrik kalibrasi, tahapan eksekusi, dan artefak model (frames.json, model.json, plots) akan dihapus secara permanen dari database SQLite dan disk.",
    runsDeleteCancel: "Batal",
    runsDeletePermanent: "Hapus Permanen",
    runsDeleting: "Menghapus...",
    runsImportSuccessToast: (name, frames) =>
      `Berhasil mengimpor dan menyimpan '${name}' (${frames} frame)!`,
    runsDeletedToast: "Riwayat pelatihan berhasil dihapus.",
    runsCopiedClipboard: "Disalin ke papan klip!",

    playerTitle: "Pemutar Simulasi Garis Waktu",
    playerPlaybookBtn: "Playbook Mitigasi",
    playerPlaybookTitle: "Playbook Intervensi Lapangan Gambut",
    playerPlaybookSubtitle: (hazardClass, pfvi) =>
      `Tingkat Bahaya Aktif: ${hazardClass} (PFVI = ${pfvi.toFixed(1)}) — Arahan operasional dan mitigasi lapangan`,
    playbookUrgencyRoutine: "Rutin",
    playbookUrgencyAdvisory: "Peringatan",
    playbookUrgencyUrgent: "Mendesak",
    playbookUrgencyEmergency: "Darurat",
    playbookFieldProtocols: "Protokol & Tindakan Lapangan",
    playbookTimingLabel: "Waktu Respons",
    playbookAuthorityLabel: "Pelaksana / Otoritas",
    playerTrendMode: "Garis Waktu",
    player3dMode: "Lahan 3D",
    playerImportBtn: "Impor",
    playerExportBtn: "Ekspor",
    playerExportCsv: "Ekspor Data CSV",
    playerDownloadJson: "Unduh Frame JSON",
    playerNoSimulationTitle: "Belum Ada Simulasi Dimuat",
    playerNoSimulationDesc:
      "Pilih atau latih model di menu Pelatihan atau Riwayat & Metrik untuk memutar garis waktu simulasi interaktif.",
    playerGoToTraining: "Buka Pelatihan Model",
    playerImportRun: "Impor Data Run",
    playerSelectFromRuns: "Pilih dari Riwayat",
    playerEnvVariablesTitle: "Variabel Lingkungan (WT, SM, Rf, Temp)",
    playerImputedToggle: "Imputasi",
    playerDividerToggle: "Pemisah FC",
    playerHoldoutToggle: "Holdout Uji",
    playerZeroGuideToggle: "Panduan Nol",
    playerHeroTitle: "Hero: Peat Fire Vulnerability Index (PFVI) & DIobs",
    playerHeroFixedScale: "(Skala Tetap [-100, 400] · PeatFR)",
    playerMinimapTitle: "Ikhtisar Garis Waktu Penuh",
    playerMinimapDragHint: "Tarik atau sapukan pada grafik untuk memperbesar",
    playerModelDetailsTitle: "Parameter Model & Determinisme",
    playerCloseBtn: "Tutup",
    playerExportSuccess: (name) => `Berhasil disimpan: ${name}`,
    playerDownloadStarted: (name) => `Mengunduh file: ${name}`,
    playerImportSuccess: (name, frames) =>
      `Berhasil mengimpor dan menyimpan '${name}' (${frames} frame)!`,
    runsExportMlflowBtn: "Ekspor ke MLflow",
    runsExportMlflowSuccess: (path) =>
      `Paket MLflow berhasil diekspor ke: ${path}. Perintah peluncuran disalin ke clipboard!`,
    runsExportingMlflow: "Mengekspor ke MLflow...",
    runsLaunchCommandCopied: "Perintah peluncuran MLflow UI disalin ke clipboard!",
    runsExportOnnxBtn: "Ekspor ke ONNX",
    runsExportOnnxSuccess: (path) =>
      `Paket ONNX Runtime berhasil diekspor ke: ${path}. Perintah inferensi disalin ke clipboard!`,
    runsExportingOnnx: "Mengekspor ke ONNX...",
    runsOnnxCommandCopied: "Perintah inferensi ONNX Runtime disalin ke clipboard!",
    playerPlayBtn: "Putar",
    playerPauseBtn: "Jeda",
    playerFcStartBtn: "Awal FC",

    dataLibraryTitle: "Koleksi Data",
    dataImportFile: "Impor Berkas Data",
    dataNoDatasetsTitle: "Belum ada dataset yang dimuat",
    dataNoDatasetsDesc: "Impor berkas CSV, Excel (.xlsx/.xls), atau Parquet untuk memulai.",
    dataImportNewBtn: "Impor Data Baru",
    dataRenameTooltip: "Ubah nama dataset",
    dataDeleteTooltip: "Hapus dataset",
    dataRowsCount: (count) => `${count} baris`,
    dataRunsCount: (count) => `${count} model`,
    dataEmptyExploreTitle: "Pilih dataset dari koleksi untuk mulai eksplorasi",
    dataEmptyExploreDesc:
      "Visualisasikan grafik garis waktu, statistik deskriptif, dan sebaran nilai hilang.",
    dataTrainCta: "Latih Model dari Data Ini",
    dataKpiRows: "baris",
    dataKpiSeriesLabel: "Parameter",
    dataKpiSeriesValue: "4 Parameter (WT, SM, Rf, Temp)",
    dataKpiMissingLabel: "Nilai Kosong",
    dataKpiMissingCells: (count, pct) => `${count} sel (${pct}%)`,
    dataKpiTimelineLabel: "Garis Waktu",
    dataKpiModelsLabel: "Model",
    dataKpiModelsTrained: (count) => `${count} terlatih`,
    dataTabStats: "Statistik Deskriptif",
    dataTabSeries: "Deret Waktu",
    dataTabDecomp: "Dekomposisi STL",
    dataTabAcf: "Autokorelasi",
    dataTabMissing: "Matriks Nilai Hilang",
    dataTabTable: "Pratinjau Tabel",
    dataAllVariables: "Semua Variabel",
    dataClickToEnlarge: "Klik untuk memperbesar",
    dataStlAvailableTeaser: (period) =>
      `Dekomposisi STL tersedia (periode ${period}) — lihat tren, musiman & residu`,
    dataStlMethodGuide: "Panduan Metode STL",
    dataStlOpenGuideTooltip: "Buka panduan metode STL",
    dataStlMethodLabel: "Metode:",
    dataStlTrend: "Tren",
    dataStlPeriodLabel: "Periode:",
    dataStlAutoTooltip: "Kembalikan ke periode otomatis",
    dataTrendStrength: "Kekuatan Tren",
    dataSeasonalStrength: "Kekuatan Musiman",
    dataDeleteModalTitle: "Hapus Dataset Ini?",
    dataDeleteModalWarning: "Tindakan ini permanen dan tidak dapat dibatalkan.",
    dataDeleteLinkedNotice:
      "Seluruh riwayat pelatihan dan metrik yang terhubung dengan dataset ini juga akan dibersihkan.",
    dataDeleteCancel: "Batal",
    dataDeleteConfirm: "Ya, Hapus Dataset",
    dataNewImportedSuccess: "Dataset baru berhasil diimpor!",
    dataNameUpdated: (name) => `Nama dataset berhasil diperbarui menjadi "${name}"`,
    dataDeletedSuccess: (name) => `Dataset "${name}" berhasil dihapus`,

    onboardingHeroTitle: "Simulator Risiko Kebakaran Lahan Gambut",
    onboardingHeroSubtitle:
      "pfrsim membantu Anda memantau dan memperkirakan potensi bahaya kebakaran hutan dan lahan gambut. Dengan menganalisis kelembapan tanah, tinggi muka air, dan kondisi cuaca, aplikasi ini membantu mendeteksi risiko lebih awal untuk mendukung pencegahan kebakaran.",
    onboardingBadgeWaterSoil: "Tinggi Muka Air & Kelembapan",
    onboardingBadgeRainWeather: "Curah Hujan & Suhu Cuaca",
    onboardingBadgeEarlyDetection: "Deteksi Dini Bahaya Kebakaran",
    onboardingUploadBtn: "Unggah Dataset",
    onboardingGoToDataBtn: "Buka Koleksi Data",
    onboardingDatasetImported: "Dataset berhasil diimpor: ",
    onboardingProceedToTraining: "Lanjut ke Pelatihan →",
    onboardingWorkflowTitle: "Panduan Alur Kerja Simulator",
    onboardingWorkflowSubtitle:
      "Empat langkah terintegrasi dari data mentah hingga pemantauan risiko kebakaran lahan gambut",
    onboardingOpenStage: "Buka Tahap Ini",
    onboardingModalTitle: "Unggah Dataset",
    onboardingModalSubtitle:
      "Tarik dan letakkan berkas di area ini, atau klik untuk memilih berkas",
    onboardingDropzonePrompt: "Pilih atau Seret Berkas ke Sini",
    onboardingDropzoneDrop: "Lepaskan berkas di sini",
    onboardingDropzoneInspecting: "Memeriksa dan Membaca Skema Berkas...",
    onboardingDropzoneFormats: "Mendukung CSV, TSV, Excel (.xlsx/.xls), dan Parquet (.parquet)",
    onboardingDropzoneMapperHint: "Format kolom diperiksa otomatis dengan pemeta interaktif",
    onboardingUnsupportedFormat:
      "Format berkas tidak didukung. Harap unggah berkas CSV, Excel (.xlsx/.xls), atau Parquet.",
    onboardingCancel: "Batal",
    onboardingSuccessToast: "Dataset berhasil diimpor!",
  },
  en: {
    appTitle: "pfrsim",
    appSubtitle: "Tropical Peatland Fire Risk Simulator",
    overviewSection: "Overview & Guide",
    pipelineSection: "Model Pipeline",
    onboardingTab: "Getting Started",
    decideTab: "Risk Summary",
    dataTab: "Data Library",
    trainTab: "Model Training",
    playerTab: "Risk Simulation",
    runsTab: "Runs & Models",
    glossaryButton: "Terminology Glossary",
    shortcutsButton: "Keyboard Shortcuts",
    referenceSection: "Help & Reference",
    sidebarClickHint: "Click: open in active tab, Ctrl+Click: new tab",
    openInNewTab: (name) => `Open ${name} in new tab`,
    closeAllTabs: "Close All Tabs",
    closeAllTooltip: "Close all tabs (Reset to Getting Started)",
    closeTab: "Close Tab",
    closeCurrentTab: "Close Current Tab",
    closeOtherTabs: "Close Other Tabs",
    newTab: "New Tab",
    newTabTooltip: "New Tab (Getting Started)",
    openTabsTitle: "Open Tabs",
    clickToSwitch: "Click to switch",
    searchTabsPlaceholder: "Search tabs...",
    overflowBadge: "overflow",

    decideHeadlineTitle: "Peat Fire Risk Summary",
    decideHorizonPrefix: "Forecast horizon:",
    decideFreshnessPrefix: "Observed data through:",
    decideStationPrefix: "Monitoring Station / Location:",
    decideDriversTitle: "Key Environmental Drivers",
    decideDriversSubtitle: "Underlying hydrological and meteorological field conditions",
    decideConfidenceTitle: "Data Confidence & Methodological Notes",
    decideConfidenceSubtitle: "Data fidelity caveats and imputation transparency",
    decideActionsTitle: "Recommended Field Actions",
    decideActionsSubtitle: "Operational guidelines based on peat fire hazard severity",
    decideNextStepsTitle: "Next Operational Steps",
    decideSeePlayer: "Inspect in Interactive Timeline",
    decideCompareRuns: "Compare Model Metrics",
    decideExportReport: "Export Situation Report",
    decideEmptyTitle: "No Trained Model Run Found",
    decideEmptyDesc:
      "Import a CSV/Excel dataset or load the Sabangau demo sample to view immediate risk assessments.",
    decideEmptyCta: "Load Sabangau Demo Sample (1-Click)",

    caveatEstimatedData: (c) =>
      `${c} daily observations were estimated via imputation, not measured directly by field sensors.`,
    caveatMethodAutomatic:
      "Forecast method: Automatic adaptive pattern timeseries (AutoARIMA + Box-Cox transformation).",
    caveatAgreement: (cls) => `Two compared modeling methods agree on risk classification: ${cls}.`,
    caveatGridTruncated: "Parameter grid search was bounded to guarantee responsive execution.",
    caveatEdgeNa: "Boundary missing observations were present at beginning or end of raw series.",
    caveatUnboundedSm:
      "Soil moisture projection indicates critically desiccated upper peat conditions.",
    caveatHighConfidence: "High observation completeness with minimal sensor dropout gaps.",

    classLow: "Low (Safe)",
    classModerate: "Moderate (Advisory)",
    classHigh: "High (Alert)",
    classExtreme: "Extreme (Danger)",

    glossaryTitle: "Terminology & Parameter Glossary",
    glossaryClose: "Close Glossary",
    glossaryWtTitle: "Water Table Depth (WT)",
    glossaryWtDesc:
      "Distance of water level below peat surface in meters (negative value). Levels dropping below -0.4 m expose the upper peat matrix to subterranean smoldering combustion.",
    glossarySmTitle: "Soil Moisture (SM)",
    glossarySmDesc:
      "Volumetric moisture content in upper peat horizon (%). Values below 30-35% signal dry combustible fuel that is highly susceptible to sustained smoldering.",
    glossaryRfTitle: "Rainfall (Rf)",
    glossaryRfDesc:
      "Daily cumulative precipitation measured at the weather station in millimeters (mm). Events exceeding 5 mm replenish surface moisture and interrupt fire spread.",
    glossaryTempTitle: "Air Temperature (Temp)",
    glossaryTempDesc:
      "Mean daily ambient air temperature (°C). Elevated temperatures amplify evapotranspiration and accelerate peat drying.",
    glossaryPfviTitle: "Peat Fire Vulnerability Index (PFVI)",
    glossaryPfviDesc:
      "Integrated vulnerability index (scale 0 - 300) computed from non-linear interactions between groundwater drawdown, fuel dryness, and weather trends.",
    glossaryClassesTitle: "PFVI Hazard Severity Categories",
    glossaryClassesDesc:
      "0–75: Low (wet/safe peat), 76–150: Moderate (drying trend), 151–225: High (active fire hazard), 226–300: Extreme (severe wildfire and haze threat).",

    trainTitle: "Model Training Config",
    trainSubtitle: "Configure imputer, forecaster, and Nelder-Mead PFVI calibration",
    trainMathDocs: "Math Docs",
    trainMathDocsTooltip: "View Mathematical Formulation",
    trainResizeHint: "Drag to resize configuration panel (Double-click to reset)",
    trainPresetsTitle: "Scientific Presets",
    trainCustomModified: "Custom Modified",
    trainPresetApplied: (name) => `Preset applied: ${name}`,
    trainTargetDataset: "Target Dataset",
    trainDatasetsLoaded: (count) => `${count} loaded`,
    trainNoDatasetPlaceholder: "-- No datasets loaded, load sample below --",
    trainNoDatasetEmptyText: "No datasets loaded yet",
    trainNoDatasetWarningTitle: "No Target Dataset Loaded",
    trainNoDatasetWarningDesc: "Import CSV/Parquet in Data page or Onboarding first.",
    trainGoToData: "Go to Data",
    trainTotalTimesteps: "Total Timesteps",
    trainRows: "rows",
    trainMissingGaps: "Missing Gaps",
    trainPastRuns: (count) => `${count} past trained runs`,
    trainInspectInData: "Inspect in Data View",
    trainImputationTitle: "Imputation Algorithm",
    trainImputationInfoTitle: "Missing Data Imputation",
    trainImputationInfoDesc:
      "Peatland telemetry sensors frequently suffer missing intervals due to power outages or network telemetry drops. Imputation reconstructs full multivariate trajectories.",
    trainImputationKnnDesc: "Reconstructs gaps using similarity patterns across all 4 sensors.",
    trainImputationLinearDesc: "Fast linear interpolation between observed gap boundaries.",
    trainImputationSplineDesc: "Smooth continuous cubic curve interpolation for natural curves.",
    trainImputationLoessDesc: "Adaptive local regression smoothing robust to non-linear trends.",
    trainImputationKnnParam: "k-Nearest Neighbors (k):",
    trainImputationKnnHint:
      "Number of donor observations in Euclidean 4D space (WT, SM, Rf, Temp).",
    trainImputationLoessParam: "Smoothing span (α):",
    trainImputationLoessHint:
      "Proportion of data points in local neighborhood for weighted tricube regression.",
    trainImputationLinearBanner:
      "Fast linear interpolation between gap boundaries. Lightweight and maintains basic continuity.",
    trainImputationSplineBanner:
      "Smooth cubic spline interpolation. Produces natural, continuous curves across missing gaps.",
    trainForecasterTitle: "Forecaster Algorithm",
    trainForecasterInfoTitle: "Multi-Step Forecasting",
    trainForecasterInfoDesc:
      "Forecasters extrapolate peat variables h steps ahead into the future to predict fire hazard prior to seasonal drying.",
    trainForecasterArimaBadge: "Statistical Baseline",
    trainForecasterArimaDesc:
      "Fast, reliable automated statistical model best suited for seasonal trends.",
    trainForecasterLstmBadge: "Neural Network",
    trainForecasterLstmDesc:
      "Deep learning neural network capable of capturing complex long-term patterns.",
    trainForecasterGruBadge: "Fast Recurrent",
    trainForecasterGruDesc:
      "Streamlined recurrent network that trains quickly while capturing dynamic trends.",
    trainForecasterDefaultDesc: "Multivariate time-series forecasting.",
    trainSplitRatioParam: "Holdout evaluation split ratio:",
    trainSplitRatioHint:
      "Splits series into training vs holdout evaluation. Estimates Box-Cox profile λ, orders (p,d,q), and computes out-of-sample RMSE and Ljung-Box test.",
    trainDlArch: (name) => `${name} Neural Architecture`,
    trainDlDeviceCpu: "CPU",
    trainDlDeviceGpu: "GPU",
    trainDlLookback: "Lookback:",
    trainDlEpochs: "Epochs:",
    trainDlUnits: "Units (d):",
    trainDlBatchSize: "Batch Size (B):",
    trainDlFullBatch: "Full Batch",
    trainDlFullBatchDesc:
      "Full batch gradient descent without mini-batch partitioning (entire N_train evaluated per epoch).",
    trainDlLearningRate: "Learning Rate (η):",
    trainDlBatchFit: (backend, range) => `Optimal ${backend} batch envelope: ${range}`,
    trainDlGpuActive: (name, backend) => `Hardware acceleration enabled (${name} · ${backend}).`,
    trainDlGpuRequested:
      "GPU mode requested (automatic fallback to CPU tensor engine if device unavailable).",
    trainDlCpuActive: "Optimized multi-threaded CPU tensor execution (Rayon & SIMD).",
    trainDlGpuUnavailable: "GPU unavailable",
    trainGpuAccel: "GPU Acceleration",
    trainGpuScore: (score) => `Score: ${score}/100`,
    trainGpuDefaultName: "Hardware GPU",
    trainGpuDefaultTier: "Hardware Accelerated GPU",
    trainGpuNoGpu: "No GPU Detected",
    trainDlLearningRateHint:
      "Step size for gradient descent optimization (typically 0.001 - 0.05).",
    trainDlGuideTitle: "Deep Learning Hyperparameter Best Practice Guide",
    trainDlGuideLookbackTitle: "Lookback Sequence Window (L)",
    trainDlGuideLookbackDesc:
      "Historical sequence timesteps used to forecast horizon h. Use 12 for monthly hydrology (annual seasonal cycle), or 7–14 for daily series. Values >30 increase latency without improving predictive skill.",
    trainDlGuideEpochsTitle: "Training Epochs (E)",
    trainDlGuideEpochsDesc:
      "Complete passes through the dataset. 50–150 epochs are standard; LSTM/GRU with Adam typically achieves steady loss convergence within 60–80 epochs.",
    trainDlGuideUnitsTitle: "Hidden State Units (d)",
    trainDlGuideUnitsDesc:
      "Dimensionality of the recurrent memory state. 16 units provides optimal regularization against overfitting sensor noise; 32–64 units captures complex non-linear multivariate interactions.",
    trainDlGuideBatchTitle: "Batch Size (B) & Full Batch",
    trainDlGuideBatchDesc:
      "Mini-batch (32–128) accelerates GPU parallel throughput with stochastic regularization. Full Batch (0) computes exact true gradients across all training samples per epoch, ideal for deterministic CPU stability.",
    trainDlGuideLrTitle: "Adam Learning Rate (η)",
    trainDlGuideLrDesc:
      "Step size for Adam optimizer. Default 0.01–0.02 on min-max normalized features [0, 1]. Reduce to 0.005 or 0.001 if training loss oscillates.",
    trainDlGuideHardwareTitle: "Hardware Acceleration",
    trainDlGuideHardwareDesc:
      "GPU (wgpu) provides 5x–8x faster execution on batch sizes >=64. Multi-threaded CPU (Rayon) is optimal for small batches or Full Batch execution.",
    trainGpuBenchmarkScore: "Compute Benchmark Score",
    trainGpuVram: "Memory (VRAM)",
    trainGpuEstSpeedup: "Est. Speedup",
    trainGpuDriver: (driver) => `Driver: ${driver}`,
    trainGpuHardwareLayer: "Hardware Layer",
    trainPfviSettingsTitle: "PFVI & Nelder-Mead Settings",
    trainPfviInfoTitle: "PFVI Calibration",
    trainPfviInfoDesc:
      "The Nelder-Mead simplex algorithm calibrates the nonlinear peat fire vulnerability function against ground-truth drought observations (DIobs).",
    trainPfviHorizonParam: "Horizon (h steps):",
    trainPfviAnnualRainParam: "Annual Rain R0:",
    trainPfviMaxGridParam: "Max Grid (m):",
    trainPfviRandomSeed: "Random Seed:",
    trainPfviRandomBtn: "Random",
    trainStartBtn: "Start Model Training",
    trainStartingBtn: "Starting Pipeline Job...",
    trainPleaseSelectDataset: "Please select a dataset first.",
    trainJobQueuedSuccess: "Model training job queued successfully!",
    trainJobCanceled: "Training job canceled",
    trainJobsHistoryTitle: "Training Jobs History",
    trainJobsHistorySubtitle: "Real-time background pipeline supervisor with state persistence",
    trainClearFinishedBtn: "Clear Finished",
    trainClearFinishedTooltip: (count) => `Clear ${count} completed/failed jobs from list`,
    trainClearFilteredBtn: (filter) => {
      switch (filter) {
        case "running":
          return "Cancel & Delete";
        case "done":
          return "Clear Completed";
        case "error":
          return "Clear Failed";
        default:
          return "Delete All";
      }
    },
    trainClearFilteredTooltip: (count, filter) =>
      `Delete ${count} filtered jobs (${filter}) from list`,
    trainClearFilteredDialogTitle: (filter) => {
      switch (filter) {
        case "running":
          return "Cancel & Delete Running Jobs?";
        case "done":
          return "Clear Completed Training Jobs?";
        case "error":
          return "Clear Failed Training Jobs?";
        default:
          return "Delete All Filtered Training Jobs?";
      }
    },
    trainClearFilteredDialogSubtitle: (count, filter) =>
      `${count} jobs (${filter}) will be deleted from history`,
    trainClearFilteredDialogDesc: (filter) => {
      switch (filter) {
        case "running":
          return "All currently running or queued jobs will be immediately canceled and removed from the background supervisor.";
        case "done":
          return "All completed job records will be removed from the background list. Saved model runs and calibration artifacts in SQLite remain safe.";
        case "error":
          return "All failed job records will be cleared from the list.";
        default:
          return "All jobs matching the current filter will be deleted from history. Any running jobs in this selection will be canceled first.";
      }
    },
    trainClearFilteredConfirmBtn: (filter) =>
      filter === "running" ? "Yes, Cancel & Delete" : "Yes, Delete",
    trainRefreshBtn: "Refresh",
    trainRefreshTooltip: "Refresh jobs and datasets list",
    trainRefreshedToast: "Jobs and datasets refreshed.",
    trainFilterAll: "All",
    trainFilterRunning: "Running",
    trainFilterDone: "Done",
    trainFilterError: "Error",
    trainSearchPlaceholder: "Search jobs, dataset...",
    trainNoJobsMatchingFilter: "No jobs matching filter",
    trainNoJobsSubmittedYet: "No training jobs submitted yet",
    trainNoJobsMatchingFilterDesc: "Adjust your search terms or reset the status filter.",
    trainNoJobsSubmittedYetDesc:
      "Select a target dataset on the left panel, configure algorithms, and click 'Start Model Training'.",
    trainResetFilters: "Reset Filters",
    trainJobIdCopied: "Job ID copied!",
    trainJobDeletedToast: "Training job record deleted.",
    trainNoFinishedJobsToClear: "No finished jobs to clear.",
    trainJobsClearedToast: (count) => `${count} completed jobs cleared from history.`,
    trainTrainingSucceeded: "Training Succeeded",
    trainViewMetrics: "View Metrics",
    trainOpenInPlayer: "Open in Player",
    trainViewSteps: "View Steps",
    trainHideSteps: "Hide Steps",
    trainCancelJob: "Cancel",
    trainDeleteDialogTitle: "Delete Training Job Record?",
    trainDeleteDialogDesc: "This will remove the job record from history.",
    trainDeleteConfirmBtn: "Delete",
    trainDeletingBtn: "Deleting...",
    trainCancelBtn: "Cancel",
    trainClearDialogTitle: "Clear Finished Training Jobs?",
    trainClearDialogSubtitle: (count) => `${count} completed/failed jobs will be cleared`,
    trainClearDialogDesc:
      "All completed and failed job records will be removed from the background list. Saved model runs and calibration artifacts in SQLite will remain untouched.",
    trainClearConfirmBtn: "Yes, Clear Finished",
    trainClearingBtn: "Clearing...",
    trainMethodologyModalTitle: "Mathematical Formulation & Pipeline",
    trainCloseModal: "Close",
    trainExecutionError: "Execution Error",
    trainTabProgress: "Training Progress",
    trainTabConfig: "Detail Config",
    trainCardDataset: "Dataset & Evaluation",
    trainCardImputation: "Imputation Engine",
    trainCardArchitecture: "Model Architecture",
    trainCardPfvi: "Physical PFVI Fit",
    trainJobCompleted: "100% Completed",
    stepperStagePrefix: "Stage: ",
    stepperStageProcessing: "Processing",
    stepperStatusCompleted: "Training Completed",
    stepperStatusFailed: "Training Failed",
    stepperBackToLive: "Back to Live",
    stepperDoneCount: (done, total) => `${done} / ${total} Done`,
    stepperStatusQueued: "Queued",
    sidebarThemeLight: "Light Mode",
    sidebarThemeDark: "Dark Mode",
    sidebarThemeLightLabel: "Light",
    sidebarThemeDarkLabel: "Dark",
    sidebarPressG: "Press 'G'",
    sidebarPressQuestion: "Press '?'",
    runsEmptyFeatureCompare: "Multi-Model Benchmark",
    runsEmptyFeatureTrajectory: "PFVI Risk Trajectory",
    runsEmptyFeatureSim: "2D & 3D Simulation",
    runsReconfigureInitiated: (jobId) => `New run initiated (Job: ${jobId.slice(0, 8)}...)`,
    runsExportMlflowPickerTitle: "Choose Folder for MLflow Export",
    runsExportOnnxPickerTitle: "Choose Folder for ONNX Export",
    runsListTitle: "Runs & Models",
    runsAllDatasets: "All Datasets",
    runsSearchPlaceholder: "Search runs, ID, model...",
    runsImportBtn: "Import Run (.json / .csv)",
    runsSelectedForCompare: (count) => `${count}/10 selected for compare`,
    runsResetCompare: "Clear",
    runsNoRunsFound: "No runs found",
    runsRemoveFromCompareTooltip: "Remove from comparison",
    runsSelectToCompareTooltip: "Select to compare (max 10)",
    runsComparisonTitle: (count) => `Head-to-Head Model Comparison (${count} Runs Selected)`,
    runsComparisonSubtitle:
      "Compare holdout accuracy metrics, optimization runtimes, and projected fire risk curves",
    runsDatasetsDiffer: "datasets differ",
    runsClearComparison: "Clear comparison",
    runsComparativeCardsTitle: "Comparative Summary Cards",
    runsScrollHorizontalHint: "Scroll horizontally to view all runs",
    runsBestModelBadge: "🏆 #1 Best Model",
    runsModelNumberBadge: (num) => `#${num} Model`,
    runsMultiModelTrajectoryTitle: "Multi-Model Horizon Fire Risk Vulnerability Trajectory (PFVI)",
    runsMetricMatrixTitle: "Detailed Comparative Metric Matrix",
    runsMetricOrParam: "Metric / Param",
    runsLowerIsBetter: "(Lower is better)",
    runsFastestBadge: "Fastest",
    runsBestBadge: "Best",
    runsNoMetricHistoryTitle: "No Metric History Found",
    runsNoMetricHistoryDesc:
      "Train a model in the Training page to start logging calibration metrics into SQLite.",
    runsEmptyHeroBadge: "MODEL REGISTRY",
    runsEmptyHeroTitle: "No Model History Yet",
    runsEmptyHeroDesc:
      "Train a model in the Training page to start logging calibration metrics into SQLite, or import an existing run file.",
    runsEmptyStartTraining: "Go to Training",
    runsEmptyImportRun: "Import Run Data",
    runsEmptyManageDatasets: "Manage Datasets",
    runsEmptyFormatsNote:
      "Supports PFRSim run artifacts (.json) and batch metrics (.csv). Stored safely in local SQLite.",
    runsEmptyFeat1Title: "Multi-Model Benchmark",
    runsEmptyFeat1Desc:
      "Select 2 or more models to compare calibration MSE, holdout error, and computational latency side-by-side.",
    runsEmptyFeat1Tags: ["Multi-Select", "Metric Matrix", "Pareto-Optimal"],
    runsEmptyFeat2Title: "PFVI Horizon Trajectory",
    runsEmptyFeat2Desc:
      "Inspect multi-step risk trajectories t = n+1 to t = n+h for Water Table (WT) and Soil Moisture (SM) with danger classifications.",
    runsEmptyFeat2Tags: ["Horizon h=1..30", "WT & SM Forecast", "5 Danger Classes"],
    runsEmptyFeat3Title: "Direct 2D & 3D Simulation",
    runsEmptyFeat3Desc:
      "Deploy the best-performing model straight to the interactive Player to simulate water table dynamics across 2D maps and 3D peatland terrains.",
    runsEmptyFeat3Tags: ["2D Spatial", "3D Peat Terrain", "Export PNG & CSV"],
    runsEmptyWorkflowTitle: "Workflow from Scratch to Trained Model",
    runsEmptyWorkflowSubtitle:
      "Three streamlined steps to produce and evaluate peatland fire risk calibration models",
    runsEmptyStep1Title: "Prepare Hydrology Dataset",
    runsEmptyStep1Desc:
      "Select or upload peatland sensor time-series containing Water Table (WT), Soil Moisture (SM), and Rainfall.",
    runsEmptyStep1Btn: "Go to Data",
    runsEmptyStep2Title: "Configure & Train Model",
    runsEmptyStep2Desc:
      "Choose imputation (KNN/Mean) and forecasting (ARIMA/BiLSTM/Linear) methods, then launch model fitting.",
    runsEmptyStep2Btn: "Go to Training",
    runsEmptyStep3Title: "Evaluate & Compare",
    runsEmptyStep3Desc:
      "Calibration results are logged here automatically. Analyze risk curves, verify holdout RMSE, and pick the best model.",
    runsEmptyStep3Btn: "Learn Metrics",
    runsEmptySamplePreviewBadge: "MODEL METRIC FORMAT PREVIEW",
    runsEmptySamplePreviewNotice:
      "Sample comparative metrics and risk trajectory populated once model training completes:",
    runsEmptySampleRunName: "ARIMA(1,1,1) × KNN Imputer (Holdout 20%)",
    runsEmptySampleRunStatus: "FIT COMPLETED",
    runsEmptySampleRunId: "run_peatland_2026_arima_01",
    runsEmptySampleMetric1Label: "PFVI MSE (Calibration)",
    runsEmptySampleMetric1Desc: "Nelder-Mead 142 evals",
    runsEmptySampleMetric2Label: "WT Holdout RMSE",
    runsEmptySampleMetric2Desc: "High channel accuracy (0.024 m)",
    runsEmptySampleMetric3Label: "Risk Class (t=n+h)",
    runsEmptySampleMetric3Desc: "Warning / Class 3 (Amber)",
    runsEmptySampleMetric4Label: "Pipeline Runtime",
    runsEmptySampleMetric4Desc: "KNN 12ms • ARIMA 214ms • PFVI 98ms",
    runsEmptySampleChartTitle: "Water Level & Risk Trajectory Projection (Horizon t=n+1 .. t=n+7)",
    runsEmptySampleChartSubtitle:
      "Simulated water table drawdown and PFVI fire risk index trajectory against danger threshold",
    runsEmptySampleReadyTitle: "Ready to train your first model?",
    runsEmptySampleReadyBtn: "Start Training Now",
    runsSidebarEmptyTitle: "No Trained Models",
    runsSidebarEmptyDesc: "Trained model outcomes will automatically appear here.",
    runsSidebarEmptyAction: "Start Training",
    runsSidebarSampleTitle: "Stored Model Format",
    runsSidebarNoFilterMatch: "No matching models found",
    runsSidebarResetFilter: "Reset Filter",
    runsNoRunsFilterDesc: (query: string) =>
      `No models found matching the search keyword "${query}".`,
    runsGoToTraining: "Go to Training",
    runsImportRun: "Import Run",
    runsLoadIntoPlayer: "Load into Player",
    runsDeleteBtn: "Delete",
    runsTrainingResultTitle: "Model Training Result & Performance",
    runsFitCompletedBadge: "✓ FIT COMPLETED",
    runsRiskClassLabel: "Risk Class (t=n+h):",
    runsPfviOptimizationMse: "PFVI Optimization MSE",
    runsNelderMeadMinObjective: "Nelder-Mead min objective",
    runsOptimizerTimeSteps: "Optimizer Time / Steps",
    runsSimplexEvals: (count) => `${count} simplex evals`,
    runsWtForecastMse: "WT Forecast Error (MSE)",
    runsSmForecastMse: "SM Forecast Error (MSE)",
    runsFittedParams: "Fitted:",
    runsSingleTrajectoryTitle: "Horizon Fire Risk Vulnerability Trajectory (PFVI)",
    runsSingleTrajectorySubtitle: (h) => `Multi-step forecast trajectory t = n+1 to t = n+${h}`,
    runsHoldoutRmseBenchmark: "Holdout Channel RMSE Benchmark",
    runsRfForecastMse: "Rf Forecast Error (MSE)",
    runsTempForecastMse: "Temp Forecast Error (MSE)",
    runsAllVariablesEvalTitle: "Multi-Variable Forecast Evaluation Metrics (Holdout Evaluation)",
    runsAllVariablesEvalSubtitle:
      "Multi-step forecasting accuracy metrics (MSE, RMSE, MAE) evaluated on holdout test split",
    runsConfigPanelTitle: "Model Configuration & Hyperparameters",
    runsConfigDataset: "Dataset & Evaluation",
    runsConfigImputation: "Imputation Config",
    runsConfigForecasting: "Architecture & Hyperparameters",
    runsConfigPfvi: "PFVI Physical Parameters",
    runsProgressTrendTitle: "Training Progress & Convergence Trend",
    runsProgressTrendSubtitle:
      "Visualization of loss/error reduction across training epochs or Nelder-Mead simplex evaluations",
    runsTrendLossVsEpoch: "Loss vs. Epoch (Forecasting)",
    runsTrendSimplexConvergence: "Nelder-Mead Simplex Convergence",
    runsPfviCalibrationError: "PFVI Calibration Error",
    runsRmseLabel: "RMSE (Primary)",
    runsExecutionDevice: "Execution Device",
    runsGpuAcceleration: "GPU Acceleration",
    runsCpuExecution: "CPU Execution",
    runsGpuActiveDesc: "Hardware Acceleration Active",
    runsCpuActiveDesc: "Host Multi-Threaded Engine",
    runsOptimal: "Optimal",
    runsTarget: "Target",
    runsChannelLabel: "Channel / Variable",
    runsHoldoutSplitBadge: (pct) => `${pct}% Holdout Test Split`,
    runsTestedChannelsOptimal: "4/4 Channels Optimally Verified",
    runsOutOfSampleSplit: (pct) => `Evaluation: Out-of-sample ${pct}% split`,
    runsRmseTargetNotice: "Target: RMSE value < tolerance threshold",
    runsPipelineTotalTime: "Total",
    runsPipelineThroughput: (evals) => `Throughput: ~${evals} evals/s`,
    runsPipelineConverged: "Converged",
    runsConfigHoldoutRatio: "Holdout Split Ratio:",
    runsConfigHorizonSteps: (h) => `${h} steps`,
    runsConfigPrngSeed: (seed) => `${seed} (Deterministic)`,
    runsConfigImputerMethod: "Imputation Method:",
    runsConfigNeighbors: (k) => `k = ${k}`,
    runsConfigSmoothingSpan: (span) => `span = ${span}`,
    runsConfigEdgeNaProtection: "✓ Boundary Edge-NA Protected",
    runsConfigForecastingModel: "Forecasting Model:",
    runsConfigStatistical: "Statistical",
    runsConfigNeural: "Neural Network",
    runsConfigLookbackWindow: (l) => `${l} timesteps`,
    runsConfigHiddenUnits: (units) => `${units} hidden units`,
    runsConfigTotalEpochs: (ep) => `${ep} epochs`,
    runsConfigLearningRate: (lr) => `Learning Rate: η = ${lr}`,
    runsConfigBatchOptimizer: (batch, lr = 0.02) =>
      String(batch).toLowerCase() === "full" || String(batch) === "0"
        ? `Full Batch · Adam (lr=${lr})`
        : `Batch ${batch} · Adam (lr=${lr})`,
    runsReconfigureBtn: "Configure & Re-run",
    runsReconfigureModalTitle: "Configure & Re-run Model",
    runsReconfigureModalDesc:
      "Adjust hyperparameters (such as learning rate, epochs, and batch size) then launch a new experiment.",
    runsReconfigureLaunch: "Launch Run",
    runsReconfigureOpenTrain: "Open in Training Studio",
    runsLearningRateCol: "Learning Rate (η)",
    runsConfigObjectiveFunction: "Objective Function:",
    runsConfigHydroConstants: (r0, dt) => `R0=${r0} mm · dt=${dt} day`,
    runsConfigPeatProperties: (fc, sat) => `FC=${fc}% · SAT=${sat}%`,
    runsTabImputeLabel: "1. Data Imputation",
    runsTabForecastLabel: "2. Forecasting Model",
    runsTabPfviLabel: "3. PFVI Calibration",
    runsTabMetricsLabel: "4. MLflow Metrics Registry",
    runsImputeCompletenessTitle: "Data Completeness & Gap Recovery by Channel",
    runsImputeCompletenessSubtitle: "Real Observations vs Imputed",
    runsImputeRealObs: (pct) => `${pct} Real`,
    runsImputeGapsFixed: (pct) => `${pct} gaps recovered`,
    runsImputeNoGaps: "Complete data without missing gaps",
    runsTransferFunctionTitle: "Peatland Groundwater Fluctuation Transfer Function (WTF)",
    runsTransferFunctionSubtitle: "Van Genuchten-type retention transfer model",
    runsParamAhDesc: "aH (Drawdown Maximum Scale)",
    runsParamBhDesc: "bH (Recharge Sensitivity Slope)",
    runsParamNDesc: "n (Retention Shape Exponent)",
    runsParamAlphaDesc: "α (Capillary Suction Scale)",
    runsSystemOfRecord: "Compatible metrics for MLflow",
    runsAllFilterChip: (count) => `All (${count})`,
    runsTrendConverged: "✓ Converged",
    runsTrendSimplexEvalsCount: (count) => `${count} Evaluations`,
    runsTrendEpochsCount: (count) => `${count} Epochs`,
    runsTrendSimplexTooltipTitle: (step, total) => `Simplex Evaluation #${step} / ${total}`,
    runsTrendEpochTooltipTitle: (epoch, total) => `Epoch ${epoch} / ${total}`,
    runsTrendSimplexObjective: "Objective RMSE:",
    runsEmptyMainFeaturesTitle: "Core Workbench Features",
    runsEmptyStepNumber: (step) => `STEP 0${step}`,
    runsEmptyAutoLogged: "Auto-logged in SQLite",
    runsEmptyHorizonDays: (h) => `Horizon h=${h} days`,
    runsEmptySamplePfviIndex: (idx) => `PFVI Index = ${idx}`,
    runsEmptyDangerThreshold: "Danger Threshold (PFVI > 60)",
    runsStageRuntimeBreakdown: "Stage Runtime & Optimization",
    runsStageTabImpute: "1. Impute Stage",
    runsStageTabForecast: "2. Forecast Stage",
    runsStageTabPfvi: "3. PFVI Calibration",
    runsStageTabAllMetrics: "4. All Metrics History",
    runsImputeSummaryTitle: "Imputation Summary & Coverage",
    runsAlgorithmLabel: "Algorithm",
    runsTotalImputedCells: "Total Imputed Cells",
    runsImputedFraction: "Imputed Fraction",
    runsFlagsInvariants: "Flags & Invariants",
    runsMultivariateForecastTitle: (algo) => `Multivariate Forecast Metrics (${algo})`,
    runsPfviCalibrationMetricsTitle: "Nelder-Mead PFVI Calibration Metrics",
    runsAllLoggedMetricsTitle: (count) => `All Logged MLflow Metrics (${count} logged metrics)`,
    runsFilterMetricsPlaceholder: "Filter metric key (e.g. mse, rmse)...",
    runsDeleteDialogTitle: "Delete Model Run?",
    runsDeleteDialogWarning: "This action cannot be undone.",
    runsDeleteDialogDesc:
      "All calibration metrics, execution stages, and model artifacts (frames.json, model.json, plots) will be permanently deleted from SQLite and disk storage.",
    runsDeleteCancel: "Cancel",
    runsDeletePermanent: "Delete Permanently",
    runsDeleting: "Deleting...",
    runsImportSuccessToast: (name, frames) =>
      `Successfully imported and saved '${name}' (${frames} frames)!`,
    runsDeletedToast: "Run and its model artifacts were deleted successfully.",
    runsCopiedClipboard: "Copied to clipboard!",

    playerTitle: "Timeline Simulation Player",
    playerPlaybookBtn: "Mitigation Playbook",
    playerPlaybookTitle: "Peatland Mitigation & Field Playbook",
    playerPlaybookSubtitle: (hazardClass, pfvi) =>
      `Active Hazard Severity: ${hazardClass} (PFVI = ${pfvi.toFixed(1)}) — Operational field directives`,
    playbookUrgencyRoutine: "Routine",
    playbookUrgencyAdvisory: "Advisory",
    playbookUrgencyUrgent: "Urgent",
    playbookUrgencyEmergency: "Emergency",
    playbookFieldProtocols: "Field Protocols & Directives",
    playbookTimingLabel: "Response Window",
    playbookAuthorityLabel: "Lead Authority",
    playerTrendMode: "Trend Player",
    player3dMode: "3D Land Heatmap",
    playerImportBtn: "Import",
    playerExportBtn: "Export",
    playerExportCsv: "Export Full CSV",
    playerDownloadJson: "Download Frames JSON",
    playerNoSimulationTitle: "No Simulation Loaded",
    playerNoSimulationDesc:
      "Train a model or choose a run from Runs & Models to scrub and visualize the interactive timeline.",
    playerGoToTraining: "Go to Training",
    playerImportRun: "Import Run",
    playerSelectFromRuns: "Select from Runs",
    playerEnvVariablesTitle: "Environmental Variables",
    playerImputedToggle: "Imputed",
    playerDividerToggle: "Divider",
    playerHoldoutToggle: "Holdout Split",
    playerZeroGuideToggle: "Zero Guide",
    playerHeroTitle: "Hero: Peat Fire Vulnerability Index (PFVI) & DIobs",
    playerHeroFixedScale: "(Fixed [-100, 400] Scale)",
    playerMinimapTitle: "Full Timeline Mini-Map Overview",
    playerMinimapDragHint: "Drag or brush on charts to zoom",
    playerModelDetailsTitle: "Model Parameters & Determinism",
    playerCloseBtn: "Close",
    playerExportSuccess: (name) => `Exported successfully: ${name}`,
    playerDownloadStarted: (name) => `Downloaded: ${name}`,
    runsExportMlflowBtn: "Export to MLflow",
    runsExportMlflowSuccess: (path) =>
      `MLflow package exported to: ${path}. Launch command copied to clipboard!`,
    runsExportingMlflow: "Exporting to MLflow...",
    runsLaunchCommandCopied: "MLflow UI launch command copied to clipboard!",
    runsExportOnnxBtn: "Export to ONNX",
    runsExportOnnxSuccess: (path) =>
      `ONNX Runtime package exported to: ${path}. Inference command copied to clipboard!`,
    runsExportingOnnx: "Exporting to ONNX...",
    runsOnnxCommandCopied: "ONNX Runtime inference command copied to clipboard!",
    playerImportSuccess: (name, frames) =>
      `Successfully imported and saved '${name}' (${frames} frames)!`,
    playerPlayBtn: "Play",
    playerPauseBtn: "Pause",
    playerFcStartBtn: "FC Start",

    dataLibraryTitle: "Dataset Library",
    dataImportFile: "Import Dataset File",
    dataNoDatasetsTitle: "No datasets loaded yet",
    dataNoDatasetsDesc: "Import a CSV, Excel (.xlsx/.xls), or Parquet file to start.",
    dataImportNewBtn: "Import New Dataset",
    dataRenameTooltip: "Rename dataset",
    dataDeleteTooltip: "Delete dataset",
    dataRowsCount: (count) => `${count} rows`,
    dataRunsCount: (count) => `${count} runs`,
    dataEmptyExploreTitle: "Select a dataset from the library to explore",
    dataEmptyExploreDesc:
      "Visualize time series curves, descriptive stats, and missingness matrices.",
    dataTrainCta: "Train Model on this Dataset",
    dataKpiRows: "rows",
    dataKpiSeriesLabel: "Series",
    dataKpiSeriesValue: "4 Variables (WT, SM, Rf, Temp)",
    dataKpiMissingLabel: "Missing",
    dataKpiMissingCells: (count, pct) => `${count} cells (${pct}%)`,
    dataKpiTimelineLabel: "Timeline",
    dataKpiModelsLabel: "Models",
    dataKpiModelsTrained: (count) => `${count} trained`,
    dataTabStats: "Descriptive Statistics",
    dataTabSeries: "Time Series",
    dataTabDecomp: "STL Decomposition",
    dataTabAcf: "Autocorrelation",
    dataTabMissing: "Missing Matrix",
    dataTabTable: "Data Table",
    dataAllVariables: "All Variables",
    dataClickToEnlarge: "Click to enlarge",
    dataStlAvailableTeaser: (period) =>
      `STL decomposition available (period ${period}) — view trend, seasonal & residual`,
    dataStlMethodGuide: "STL Methodology Guide",
    dataStlOpenGuideTooltip: "Open STL methodology guide",
    dataStlMethodLabel: "Method:",
    dataStlTrend: "Trend",
    dataStlPeriodLabel: "Period:",
    dataStlAutoTooltip: "Reset to auto-detected period",
    dataTrendStrength: "Trend Strength",
    dataSeasonalStrength: "Seasonal Strength",
    dataDeleteModalTitle: "Delete This Dataset?",
    dataDeleteModalWarning: "This action is permanent and cannot be undone.",
    dataDeleteLinkedNotice:
      "All training jobs and MLflow metrics linked to this dataset will also be cleared.",
    dataDeleteCancel: "Cancel",
    dataDeleteConfirm: "Yes, Delete Dataset",
    dataNewImportedSuccess: "New dataset imported successfully!",
    dataNameUpdated: (name) => `Dataset name updated to "${name}"`,
    dataDeletedSuccess: (name) => `Dataset "${name}" deleted successfully`,

    onboardingHeroTitle: "Peatland Fire Risk Simulator",
    onboardingHeroSubtitle:
      "pfrsim helps you monitor and forecast wildfire risks across peatland environments. By analyzing soil moisture, water table levels, and weather conditions, it enables early hazard detection to support timely fire prevention.",
    onboardingBadgeWaterSoil: "Water Levels & Soil Moisture",
    onboardingBadgeRainWeather: "Rainfall & Weather Trends",
    onboardingBadgeEarlyDetection: "Early Fire Hazard Detection",
    onboardingUploadBtn: "Upload Dataset",
    onboardingGoToDataBtn: "Go to Data Page",
    onboardingDatasetImported: "Dataset imported successfully: ",
    onboardingProceedToTraining: "Proceed to Training →",
    onboardingWorkflowTitle: "Simulator Workflow Guide",
    onboardingWorkflowSubtitle:
      "Four integrated stages from raw environmental data to actionable fire risk intelligence",
    onboardingOpenStage: "Open Stage",
    onboardingModalTitle: "Upload Dataset",
    onboardingModalSubtitle: "Drag and drop file here, or click to browse files",
    onboardingDropzonePrompt: "Select or Drag & Drop File Here",
    onboardingDropzoneDrop: "Drop file here",
    onboardingDropzoneInspecting: "Inspecting File Schema & Columns...",
    onboardingDropzoneFormats: "Supports CSV, TSV, Excel (.xlsx/.xls), and Parquet (.parquet)",
    onboardingDropzoneMapperHint: "Column format inspected automatically with interactive mapper",
    onboardingUnsupportedFormat:
      "Unsupported file format. Please upload a CSV, Excel (.xlsx/.xls), or Parquet file.",
    onboardingCancel: "Cancel",
    onboardingSuccessToast: "Dataset imported successfully!",
  },
};
