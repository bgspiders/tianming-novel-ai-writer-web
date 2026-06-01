using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TM.Web.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_providers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    DefaultEndpoint = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    IconUrl = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true),
                    IsBuiltIn = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_providers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "app_settings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Key = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Value = table.Column<string>(type: "TEXT", nullable: false),
                    ValueType = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_settings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "book_analyses",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Icon = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    Author = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Genre = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceUrl = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: false),
                    SourceBookTitle = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    SourceAuthor = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    SourceGenre = table.Column<string>(type: "TEXT", nullable: false),
                    SourceKeywords = table.Column<string>(type: "TEXT", nullable: false),
                    SourceSite = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    ChapterCount = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalWordCount = table.Column<int>(type: "INTEGER", nullable: false),
                    CrawledAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    WorldBuildingMethod = table.Column<string>(type: "TEXT", nullable: false),
                    PowerSystemDesign = table.Column<string>(type: "TEXT", nullable: false),
                    EnvironmentDescription = table.Column<string>(type: "TEXT", nullable: false),
                    FactionDesign = table.Column<string>(type: "TEXT", nullable: false),
                    WorldviewHighlights = table.Column<string>(type: "TEXT", nullable: false),
                    ProtagonistDesign = table.Column<string>(type: "TEXT", nullable: false),
                    SupportingRoles = table.Column<string>(type: "TEXT", nullable: false),
                    CharacterRelations = table.Column<string>(type: "TEXT", nullable: false),
                    GoldenFingerDesign = table.Column<string>(type: "TEXT", nullable: false),
                    CharacterHighlights = table.Column<string>(type: "TEXT", nullable: false),
                    PlotStructure = table.Column<string>(type: "TEXT", nullable: false),
                    ConflictDesign = table.Column<string>(type: "TEXT", nullable: false),
                    ClimaxArrangement = table.Column<string>(type: "TEXT", nullable: false),
                    ForeshadowingTechnique = table.Column<string>(type: "TEXT", nullable: false),
                    PlotHighlights = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_book_analyses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ModuleType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ParentId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    IsBuiltIn = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "chapter_blueprints",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    DependencyModuleVersions = table.Column<string>(type: "TEXT", nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    OneLineStructure = table.Column<string>(type: "TEXT", nullable: false),
                    PacingCurve = table.Column<string>(type: "TEXT", nullable: false),
                    SceneNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    SceneTitle = table.Column<string>(type: "TEXT", nullable: false),
                    PovCharacter = table.Column<string>(type: "TEXT", nullable: false),
                    EstimatedWordCount = table.Column<string>(type: "TEXT", nullable: false),
                    Opening = table.Column<string>(type: "TEXT", nullable: false),
                    Development = table.Column<string>(type: "TEXT", nullable: false),
                    Turning = table.Column<string>(type: "TEXT", nullable: false),
                    Ending = table.Column<string>(type: "TEXT", nullable: false),
                    InfoDrop = table.Column<string>(type: "TEXT", nullable: false),
                    Cast = table.Column<string>(type: "TEXT", nullable: false),
                    Locations = table.Column<string>(type: "TEXT", nullable: false),
                    Factions = table.Column<string>(type: "TEXT", nullable: false),
                    ItemsClues = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chapter_blueprints", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "chapter_plans",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    DependencyModuleVersions = table.Column<string>(type: "TEXT", nullable: false),
                    ChapterTitle = table.Column<string>(type: "TEXT", nullable: false),
                    ChapterNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    Volume = table.Column<string>(type: "TEXT", nullable: false),
                    EstimatedWordCount = table.Column<string>(type: "TEXT", nullable: false),
                    ChapterTheme = table.Column<string>(type: "TEXT", nullable: false),
                    ReaderExperienceGoal = table.Column<string>(type: "TEXT", nullable: false),
                    MainGoal = table.Column<string>(type: "TEXT", nullable: false),
                    ResistanceSource = table.Column<string>(type: "TEXT", nullable: false),
                    KeyTurn = table.Column<string>(type: "TEXT", nullable: false),
                    Hook = table.Column<string>(type: "TEXT", nullable: false),
                    WorldInfoDrop = table.Column<string>(type: "TEXT", nullable: false),
                    CharacterArcProgress = table.Column<string>(type: "TEXT", nullable: false),
                    MainPlotProgress = table.Column<string>(type: "TEXT", nullable: false),
                    Foreshadowing = table.Column<string>(type: "TEXT", nullable: false),
                    ReferencedCharacterNames = table.Column<string>(type: "TEXT", nullable: false),
                    ReferencedFactionNames = table.Column<string>(type: "TEXT", nullable: false),
                    ReferencedLocationNames = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chapter_plans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "chapter_timelines",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    TimePeriod = table.Column<string>(type: "TEXT", nullable: false),
                    ElapsedTime = table.Column<string>(type: "TEXT", nullable: false),
                    KeyTimeEvent = table.Column<string>(type: "TEXT", nullable: false),
                    Importance = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chapter_timelines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "character_locations",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CharacterName = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    CurrentLocation = table.Column<string>(type: "TEXT", nullable: false),
                    LastUpdatedChapter = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_locations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "character_movements",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CharacterName = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    FromLocation = table.Column<string>(type: "TEXT", nullable: false),
                    ToLocation = table.Column<string>(type: "TEXT", nullable: false),
                    Importance = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_movements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "character_rules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CharacterType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Gender = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Age = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Identity = table.Column<string>(type: "TEXT", nullable: false),
                    Race = table.Column<string>(type: "TEXT", nullable: false),
                    Appearance = table.Column<string>(type: "TEXT", nullable: false),
                    Want = table.Column<string>(type: "TEXT", nullable: false),
                    Need = table.Column<string>(type: "TEXT", nullable: false),
                    FlawBelief = table.Column<string>(type: "TEXT", nullable: false),
                    GrowthPath = table.Column<string>(type: "TEXT", nullable: false),
                    TargetCharacterName = table.Column<string>(type: "TEXT", nullable: false),
                    RelationshipType = table.Column<string>(type: "TEXT", nullable: false),
                    EmotionDynamic = table.Column<string>(type: "TEXT", nullable: false),
                    CombatSkills = table.Column<string>(type: "TEXT", nullable: false),
                    NonCombatSkills = table.Column<string>(type: "TEXT", nullable: false),
                    SpecialAbilities = table.Column<string>(type: "TEXT", nullable: false),
                    SignatureItems = table.Column<string>(type: "TEXT", nullable: false),
                    CommonItems = table.Column<string>(type: "TEXT", nullable: false),
                    PersonalAssets = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "character_state_entries",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CharacterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    BaseProfile = table.Column<string>(type: "TEXT", nullable: false),
                    DriftWarnings = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_state_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "chat_sessions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Title = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Mode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    ModelCode = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    ProviderId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    LastMessageAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chat_sessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "conflict_progress_entries",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Tier = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    InvolvedChapters = table.Column<string>(type: "TEXT", nullable: false),
                    InvolvedCharacters = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conflict_progress_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "creative_materials",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Icon = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    SourceBookName = table.Column<string>(type: "TEXT", maxLength: 256, nullable: true),
                    Genre = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    OverallIdea = table.Column<string>(type: "TEXT", nullable: false),
                    WorldBuildingMethod = table.Column<string>(type: "TEXT", nullable: false),
                    PowerSystemDesign = table.Column<string>(type: "TEXT", nullable: false),
                    EnvironmentDescription = table.Column<string>(type: "TEXT", nullable: false),
                    FactionDesign = table.Column<string>(type: "TEXT", nullable: false),
                    WorldviewHighlights = table.Column<string>(type: "TEXT", nullable: false),
                    ProtagonistDesign = table.Column<string>(type: "TEXT", nullable: false),
                    SupportingRoles = table.Column<string>(type: "TEXT", nullable: false),
                    CharacterRelations = table.Column<string>(type: "TEXT", nullable: false),
                    GoldenFingerDesign = table.Column<string>(type: "TEXT", nullable: false),
                    CharacterHighlights = table.Column<string>(type: "TEXT", nullable: false),
                    PlotStructure = table.Column<string>(type: "TEXT", nullable: false),
                    ConflictDesign = table.Column<string>(type: "TEXT", nullable: false),
                    ClimaxArrangement = table.Column<string>(type: "TEXT", nullable: false),
                    ForeshadowingTechnique = table.Column<string>(type: "TEXT", nullable: false),
                    PlotHighlights = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_creative_materials", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "faction_rules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    FactionType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Goal = table.Column<string>(type: "TEXT", nullable: false),
                    StrengthTerritory = table.Column<string>(type: "TEXT", nullable: false),
                    Leader = table.Column<string>(type: "TEXT", nullable: false),
                    CoreMembers = table.Column<string>(type: "TEXT", nullable: false),
                    MemberTraits = table.Column<string>(type: "TEXT", nullable: false),
                    Allies = table.Column<string>(type: "TEXT", nullable: false),
                    Enemies = table.Column<string>(type: "TEXT", nullable: false),
                    NeutralCompetitors = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_faction_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "faction_state_entries",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    FactionId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    CurrentStatus = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_faction_state_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "foreshadowings",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Tier = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                    IsSetup = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsResolved = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsOverdue = table.Column<bool>(type: "INTEGER", nullable: false),
                    ExpectedSetupChapter = table.Column<string>(type: "TEXT", nullable: false),
                    ExpectedPayoffChapter = table.Column<string>(type: "TEXT", nullable: false),
                    ActualSetupChapter = table.Column<string>(type: "TEXT", nullable: false),
                    ActualPayoffChapter = table.Column<string>(type: "TEXT", nullable: false),
                    OverdueSuggestion = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_foreshadowings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "generation_records",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Success = table.Column<bool>(type: "INTEGER", nullable: false),
                    TotalAttempts = table.Column<int>(type: "INTEGER", nullable: false),
                    RewriteCount = table.Column<int>(type: "INTEGER", nullable: false),
                    FailureStages = table.Column<string>(type: "TEXT", nullable: false),
                    Attempts = table.Column<string>(type: "TEXT", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    FinishedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_generation_records", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "generation_statistics",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    TotalGenerations = table.Column<int>(type: "INTEGER", nullable: false),
                    FirstPassCount = table.Column<int>(type: "INTEGER", nullable: false),
                    RewriteCount = table.Column<int>(type: "INTEGER", nullable: false),
                    FailureCount = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalInputTokens = table.Column<long>(type: "INTEGER", nullable: false),
                    TotalOutputTokens = table.Column<long>(type: "INTEGER", nullable: false),
                    TotalCostMicros = table.Column<long>(type: "INTEGER", nullable: false),
                    LastUpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_generation_statistics", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "global_summary_cache",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Payload = table.Column<string>(type: "TEXT", nullable: false),
                    ComputedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DataVersion = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_global_summary_cache", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "item_state_entries",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    CurrentHolder = table.Column<string>(type: "TEXT", nullable: false),
                    CurrentStatus = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_item_state_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "keyword_chapter_index",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    Keyword = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    OccurrenceCount = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_keyword_chapter_index", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "layer_completion_status",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Layer = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    IsCompleted = table.Column<bool>(type: "INTEGER", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    DataVersion = table.Column<int>(type: "INTEGER", nullable: false),
                    SummaryVersion = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_layer_completion_status", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "location_rules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    LocationType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Scale = table.Column<string>(type: "TEXT", nullable: false),
                    Terrain = table.Column<string>(type: "TEXT", nullable: false),
                    Climate = table.Column<string>(type: "TEXT", nullable: false),
                    Landmarks = table.Column<string>(type: "TEXT", nullable: false),
                    Resources = table.Column<string>(type: "TEXT", nullable: false),
                    HistoricalSignificance = table.Column<string>(type: "TEXT", nullable: false),
                    Dangers = table.Column<string>(type: "TEXT", nullable: false),
                    FactionId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_location_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "location_state_entries",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    LocationId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    CurrentStatus = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_location_state_entries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "manifests",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    PublishedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Files = table.Column<string>(type: "TEXT", nullable: false),
                    EnabledModules = table.Column<string>(type: "TEXT", nullable: false),
                    Statistics = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_manifests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "notification_history",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Type = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Body = table.Column<string>(type: "TEXT", nullable: false),
                    RouteLink = table.Column<string>(type: "TEXT", nullable: true),
                    IsRead = table.Column<bool>(type: "INTEGER", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_history", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "outlines",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    DependencyModuleVersions = table.Column<string>(type: "TEXT", nullable: false),
                    TotalChapterCount = table.Column<int>(type: "INTEGER", nullable: false),
                    EstimatedWordCount = table.Column<string>(type: "TEXT", nullable: false),
                    OneLineOutline = table.Column<string>(type: "TEXT", nullable: false),
                    EmotionalTone = table.Column<string>(type: "TEXT", nullable: false),
                    PhilosophicalMotif = table.Column<string>(type: "TEXT", nullable: false),
                    Theme = table.Column<string>(type: "TEXT", nullable: false),
                    CoreConflict = table.Column<string>(type: "TEXT", nullable: false),
                    EndingState = table.Column<string>(type: "TEXT", nullable: false),
                    VolumeDivision = table.Column<string>(type: "TEXT", nullable: false),
                    OutlineOverview = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outlines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "plot_points",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", nullable: true),
                    Context = table.Column<string>(type: "TEXT", nullable: false),
                    Keywords = table.Column<string>(type: "TEXT", nullable: false),
                    InvolvedCharacters = table.Column<string>(type: "TEXT", nullable: false),
                    Importance = table.Column<string>(type: "TEXT", nullable: false),
                    Storyline = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_plot_points", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "plot_rules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    TargetVolume = table.Column<string>(type: "TEXT", nullable: false),
                    AssignedVolume = table.Column<string>(type: "TEXT", nullable: false),
                    OneLineSummary = table.Column<string>(type: "TEXT", nullable: false),
                    EventType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    StoryPhase = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    PrerequisitesTrigger = table.Column<string>(type: "TEXT", nullable: false),
                    MainCharacters = table.Column<string>(type: "TEXT", nullable: false),
                    KeyNpcs = table.Column<string>(type: "TEXT", nullable: false),
                    Location = table.Column<string>(type: "TEXT", nullable: false),
                    TimeDuration = table.Column<string>(type: "TEXT", nullable: false),
                    StepTitle = table.Column<string>(type: "TEXT", nullable: false),
                    Goal = table.Column<string>(type: "TEXT", nullable: false),
                    Conflict = table.Column<string>(type: "TEXT", nullable: false),
                    Result = table.Column<string>(type: "TEXT", nullable: false),
                    EmotionCurve = table.Column<string>(type: "TEXT", nullable: false),
                    MainPlotPush = table.Column<string>(type: "TEXT", nullable: false),
                    CharacterGrowth = table.Column<string>(type: "TEXT", nullable: false),
                    WorldReveal = table.Column<string>(type: "TEXT", nullable: false),
                    RewardsClues = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_plot_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "projects",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    CurrentSourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    LastModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_projects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "prompt_templates",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    Variables = table.Column<string>(type: "TEXT", nullable: false),
                    IsBuiltIn = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsFavorite = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_prompt_templates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "relation_strength_index",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    EntityId1 = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    EntityId2 = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Strength = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_relation_strength_index", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "source_books",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Author = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Genre = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Site = table.Column<string>(type: "TEXT", maxLength: 128, nullable: true),
                    Url = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    ChapterCount = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalWordCount = table.Column<int>(type: "INTEGER", nullable: false),
                    CrawledAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_source_books", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "themes",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Payload = table.Column<string>(type: "TEXT", nullable: false),
                    IsBuiltIn = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsFavorite = table.Column<bool>(type: "INTEGER", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_themes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "uploads",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    FileName = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    MimeType = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    StoragePath = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    SizeBytes = table.Column<long>(type: "INTEGER", nullable: false),
                    Sha256 = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Purpose = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_uploads", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "validation_reports",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ValidatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Result = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Summary = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_validation_reports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "validation_summaries",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    TargetVolumeNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    OverallResult = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    ModuleResults = table.Column<string>(type: "TEXT", nullable: false),
                    ProblemItems = table.Column<string>(type: "TEXT", nullable: false),
                    LastValidatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_validation_summaries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "volume_designs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    DependencyModuleVersions = table.Column<string>(type: "TEXT", nullable: false),
                    VolumeNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    VolumeTitle = table.Column<string>(type: "TEXT", nullable: false),
                    VolumeTheme = table.Column<string>(type: "TEXT", nullable: false),
                    StageGoal = table.Column<string>(type: "TEXT", nullable: false),
                    EstimatedWordCount = table.Column<string>(type: "TEXT", nullable: false),
                    TargetChapterCount = table.Column<int>(type: "INTEGER", nullable: false),
                    StartChapter = table.Column<int>(type: "INTEGER", nullable: false),
                    EndChapter = table.Column<int>(type: "INTEGER", nullable: false),
                    MainConflict = table.Column<string>(type: "TEXT", nullable: false),
                    PressureSource = table.Column<string>(type: "TEXT", nullable: false),
                    KeyEvents = table.Column<string>(type: "TEXT", nullable: false),
                    OpeningState = table.Column<string>(type: "TEXT", nullable: false),
                    EndingState = table.Column<string>(type: "TEXT", nullable: false),
                    ChapterAllocationOverview = table.Column<string>(type: "TEXT", nullable: false),
                    PlotAllocation = table.Column<string>(type: "TEXT", nullable: false),
                    ChapterGenerationHints = table.Column<string>(type: "TEXT", nullable: false),
                    ReferencedCharacterNames = table.Column<string>(type: "TEXT", nullable: false),
                    ReferencedFactionNames = table.Column<string>(type: "TEXT", nullable: false),
                    ReferencedLocationNames = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_volume_designs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "volume_fact_archives",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    VolumeId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    VolumeNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    LastChapterId = table.Column<string>(type: "TEXT", nullable: false),
                    ArchivedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    SnapshotPayload = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_volume_fact_archives", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "work_scope",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CurrentSourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_scope", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "world_rules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    OneLineSummary = table.Column<string>(type: "TEXT", nullable: false),
                    PowerSystem = table.Column<string>(type: "TEXT", nullable: false),
                    Cosmology = table.Column<string>(type: "TEXT", nullable: false),
                    SpecialLaws = table.Column<string>(type: "TEXT", nullable: false),
                    HardRules = table.Column<string>(type: "TEXT", nullable: false),
                    SoftRules = table.Column<string>(type: "TEXT", nullable: false),
                    AncientEra = table.Column<string>(type: "TEXT", nullable: false),
                    KeyEvents = table.Column<string>(type: "TEXT", nullable: false),
                    ModernHistory = table.Column<string>(type: "TEXT", nullable: false),
                    StatusQuo = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    CategoryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SourceBookId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_world_rules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ai_api_keys",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProviderId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    EncryptedKey = table.Column<byte[]>(type: "BLOB", nullable: false),
                    Iv = table.Column<byte[]>(type: "BLOB", nullable: false),
                    MaskedTail = table.Column<string>(type: "TEXT", maxLength: 16, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    RotationOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_api_keys", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ai_api_keys_ai_providers_ProviderId",
                        column: x => x.ProviderId,
                        principalTable: "ai_providers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ai_models",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProviderId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Code = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    ContextWindow = table.Column<int>(type: "INTEGER", nullable: true),
                    MaxOutputTokens = table.Column<int>(type: "INTEGER", nullable: true),
                    Capabilities = table.Column<string>(type: "TEXT", nullable: false),
                    InputPricePerMillion = table.Column<decimal>(type: "TEXT", precision: 18, scale: 6, nullable: true),
                    OutputPricePerMillion = table.Column<decimal>(type: "TEXT", precision: 18, scale: 6, nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_models", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ai_models_ai_providers_ProviderId",
                        column: x => x.ProviderId,
                        principalTable: "ai_providers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "character_relationship_states",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CharacterStateEntryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    TargetCharacterName = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Relation = table.Column<string>(type: "TEXT", nullable: false),
                    Trust = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_relationship_states", x => x.Id);
                    table.ForeignKey(
                        name: "FK_character_relationship_states_character_state_entries_CharacterStateEntryId",
                        column: x => x.CharacterStateEntryId,
                        principalTable: "character_state_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "character_state_points",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CharacterStateEntryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Phase = table.Column<string>(type: "TEXT", nullable: false),
                    Level = table.Column<string>(type: "TEXT", nullable: false),
                    Abilities = table.Column<string>(type: "TEXT", nullable: false),
                    MentalState = table.Column<string>(type: "TEXT", nullable: false),
                    KeyEvent = table.Column<string>(type: "TEXT", nullable: false),
                    Importance = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_state_points", x => x.Id);
                    table.ForeignKey(
                        name: "FK_character_state_points_character_state_entries_CharacterStateEntryId",
                        column: x => x.CharacterStateEntryId,
                        principalTable: "character_state_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "chat_messages",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChatSessionId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Role = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    ThinkingContent = table.Column<string>(type: "TEXT", nullable: true),
                    ToolPayload = table.Column<string>(type: "TEXT", nullable: true),
                    InputTokens = table.Column<int>(type: "INTEGER", nullable: true),
                    OutputTokens = table.Column<int>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chat_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_chat_messages_chat_sessions_ChatSessionId",
                        column: x => x.ChatSessionId,
                        principalTable: "chat_sessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "conflict_progress_points",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ConflictProgressEntryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Event = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: false),
                    Importance = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conflict_progress_points", x => x.Id);
                    table.ForeignKey(
                        name: "FK_conflict_progress_points_conflict_progress_entries_ConflictProgressEntryId",
                        column: x => x.ConflictProgressEntryId,
                        principalTable: "conflict_progress_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "faction_state_points",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    FactionStateEntryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Event = table.Column<string>(type: "TEXT", nullable: false),
                    Importance = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_faction_state_points", x => x.Id);
                    table.ForeignKey(
                        name: "FK_faction_state_points_faction_state_entries_FactionStateEntryId",
                        column: x => x.FactionStateEntryId,
                        principalTable: "faction_state_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "item_state_points",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ItemStateEntryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Holder = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Event = table.Column<string>(type: "TEXT", nullable: false),
                    Importance = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_item_state_points", x => x.Id);
                    table.ForeignKey(
                        name: "FK_item_state_points_item_state_entries_ItemStateEntryId",
                        column: x => x.ItemStateEntryId,
                        principalTable: "item_state_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "location_state_points",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    LocationStateEntryId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Event = table.Column<string>(type: "TEXT", nullable: false),
                    Importance = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_location_state_points", x => x.Id);
                    table.ForeignKey(
                        name: "FK_location_state_points_location_state_entries_LocationStateEntryId",
                        column: x => x.LocationStateEntryId,
                        principalTable: "location_state_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "volumes",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    VolumeNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Theme = table.Column<string>(type: "TEXT", maxLength: 1024, nullable: true),
                    MilestoneText = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_volumes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_volumes_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "validation_items",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ValidationReportId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ValidationType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Result = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    Details = table.Column<string>(type: "TEXT", nullable: false),
                    Suggestion = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_validation_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_validation_items_validation_reports_ValidationReportId",
                        column: x => x.ValidationReportId,
                        principalTable: "validation_reports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "chapters",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    VolumeId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    WordCount = table.Column<int>(type: "INTEGER", nullable: false),
                    Summary = table.Column<string>(type: "TEXT", nullable: false),
                    ContentFilePath = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    Status = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_chapters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_chapters_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_chapters_volumes_VolumeId",
                        column: x => x.VolumeId,
                        principalTable: "volumes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ai_api_keys_ProviderId_RotationOrder",
                table: "ai_api_keys",
                columns: new[] { "ProviderId", "RotationOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ai_models_ProviderId_Code",
                table: "ai_models",
                columns: new[] { "ProviderId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ai_providers_Code",
                table: "ai_providers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_app_settings_Key",
                table: "app_settings",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_book_analyses_CategoryId",
                table: "book_analyses",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_book_analyses_Name",
                table: "book_analyses",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_book_analyses_SourceBookId",
                table: "book_analyses",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_categories_ModuleType_ParentId",
                table: "categories",
                columns: new[] { "ModuleType", "ParentId" });

            migrationBuilder.CreateIndex(
                name: "IX_categories_ModuleType_SourceBookId",
                table: "categories",
                columns: new[] { "ModuleType", "SourceBookId" });

            migrationBuilder.CreateIndex(
                name: "IX_chapter_blueprints_CategoryId",
                table: "chapter_blueprints",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_chapter_blueprints_ChapterId_SceneNumber",
                table: "chapter_blueprints",
                columns: new[] { "ChapterId", "SceneNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_chapter_blueprints_Name",
                table: "chapter_blueprints",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_chapter_blueprints_SourceBookId",
                table: "chapter_blueprints",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_chapter_plans_CategoryId",
                table: "chapter_plans",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_chapter_plans_ChapterNumber",
                table: "chapter_plans",
                column: "ChapterNumber");

            migrationBuilder.CreateIndex(
                name: "IX_chapter_plans_Name",
                table: "chapter_plans",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_chapter_plans_SourceBookId",
                table: "chapter_plans",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_chapter_timelines_ProjectId_ChapterId",
                table: "chapter_timelines",
                columns: new[] { "ProjectId", "ChapterId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_chapters_ProjectId_ChapterNumber",
                table: "chapters",
                columns: new[] { "ProjectId", "ChapterNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_chapters_VolumeId_ChapterNumber",
                table: "chapters",
                columns: new[] { "VolumeId", "ChapterNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_character_locations_ProjectId_CharacterName",
                table: "character_locations",
                columns: new[] { "ProjectId", "CharacterName" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_character_movements_ProjectId_CharacterName_ChapterId",
                table: "character_movements",
                columns: new[] { "ProjectId", "CharacterName", "ChapterId" });

            migrationBuilder.CreateIndex(
                name: "IX_character_relationship_states_CharacterStateEntryId_TargetCharacterName_ChapterId",
                table: "character_relationship_states",
                columns: new[] { "CharacterStateEntryId", "TargetCharacterName", "ChapterId" });

            migrationBuilder.CreateIndex(
                name: "IX_character_rules_CategoryId",
                table: "character_rules",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_character_rules_Name",
                table: "character_rules",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_character_rules_SourceBookId",
                table: "character_rules",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_character_state_entries_ProjectId_CharacterId",
                table: "character_state_entries",
                columns: new[] { "ProjectId", "CharacterId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_character_state_entries_ProjectId_SourceBookId",
                table: "character_state_entries",
                columns: new[] { "ProjectId", "SourceBookId" });

            migrationBuilder.CreateIndex(
                name: "IX_character_state_points_CharacterStateEntryId_ChapterId",
                table: "character_state_points",
                columns: new[] { "CharacterStateEntryId", "ChapterId" });

            migrationBuilder.CreateIndex(
                name: "IX_chat_messages_ChatSessionId_CreatedAt",
                table: "chat_messages",
                columns: new[] { "ChatSessionId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_chat_sessions_ProjectId_LastMessageAt",
                table: "chat_sessions",
                columns: new[] { "ProjectId", "LastMessageAt" });

            migrationBuilder.CreateIndex(
                name: "IX_conflict_progress_entries_ProjectId_Name",
                table: "conflict_progress_entries",
                columns: new[] { "ProjectId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_conflict_progress_points_ConflictProgressEntryId_ChapterId",
                table: "conflict_progress_points",
                columns: new[] { "ConflictProgressEntryId", "ChapterId" });

            migrationBuilder.CreateIndex(
                name: "IX_creative_materials_CategoryId",
                table: "creative_materials",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_creative_materials_Name",
                table: "creative_materials",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_creative_materials_SourceBookId",
                table: "creative_materials",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_faction_rules_CategoryId",
                table: "faction_rules",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_faction_rules_Name",
                table: "faction_rules",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_faction_rules_SourceBookId",
                table: "faction_rules",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_faction_state_entries_ProjectId_FactionId",
                table: "faction_state_entries",
                columns: new[] { "ProjectId", "FactionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_faction_state_points_FactionStateEntryId_ChapterId",
                table: "faction_state_points",
                columns: new[] { "FactionStateEntryId", "ChapterId" });

            migrationBuilder.CreateIndex(
                name: "IX_foreshadowings_ProjectId_IsResolved_IsOverdue",
                table: "foreshadowings",
                columns: new[] { "ProjectId", "IsResolved", "IsOverdue" });

            migrationBuilder.CreateIndex(
                name: "IX_foreshadowings_ProjectId_Tier",
                table: "foreshadowings",
                columns: new[] { "ProjectId", "Tier" });

            migrationBuilder.CreateIndex(
                name: "IX_generation_records_ProjectId_ChapterId_StartedAt",
                table: "generation_records",
                columns: new[] { "ProjectId", "ChapterId", "StartedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_generation_statistics_ProjectId",
                table: "generation_statistics",
                column: "ProjectId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_global_summary_cache_ProjectId",
                table: "global_summary_cache",
                column: "ProjectId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_item_state_entries_ProjectId_Name",
                table: "item_state_entries",
                columns: new[] { "ProjectId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_item_state_points_ItemStateEntryId_ChapterId",
                table: "item_state_points",
                columns: new[] { "ItemStateEntryId", "ChapterId" });

            migrationBuilder.CreateIndex(
                name: "IX_keyword_chapter_index_ProjectId_Keyword",
                table: "keyword_chapter_index",
                columns: new[] { "ProjectId", "Keyword" });

            migrationBuilder.CreateIndex(
                name: "IX_keyword_chapter_index_ProjectId_Keyword_ChapterId",
                table: "keyword_chapter_index",
                columns: new[] { "ProjectId", "Keyword", "ChapterId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_layer_completion_status_ProjectId_Layer",
                table: "layer_completion_status",
                columns: new[] { "ProjectId", "Layer" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_location_rules_CategoryId",
                table: "location_rules",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_location_rules_FactionId",
                table: "location_rules",
                column: "FactionId");

            migrationBuilder.CreateIndex(
                name: "IX_location_rules_Name",
                table: "location_rules",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_location_rules_SourceBookId",
                table: "location_rules",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_location_state_entries_ProjectId_LocationId",
                table: "location_state_entries",
                columns: new[] { "ProjectId", "LocationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_location_state_points_LocationStateEntryId_ChapterId",
                table: "location_state_points",
                columns: new[] { "LocationStateEntryId", "ChapterId" });

            migrationBuilder.CreateIndex(
                name: "IX_manifests_ProjectId_Version",
                table: "manifests",
                columns: new[] { "ProjectId", "Version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notification_history_IsRead_CreatedAt",
                table: "notification_history",
                columns: new[] { "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_outlines_CategoryId",
                table: "outlines",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_outlines_Name",
                table: "outlines",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_outlines_SourceBookId",
                table: "outlines",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_plot_points_ProjectId_ChapterId",
                table: "plot_points",
                columns: new[] { "ProjectId", "ChapterId" });

            migrationBuilder.CreateIndex(
                name: "IX_plot_rules_CategoryId",
                table: "plot_rules",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_plot_rules_Name",
                table: "plot_rules",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_plot_rules_SourceBookId",
                table: "plot_rules",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_projects_Name",
                table: "projects",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_prompt_templates_Category_SortOrder",
                table: "prompt_templates",
                columns: new[] { "Category", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_prompt_templates_Code",
                table: "prompt_templates",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_relation_strength_index_ProjectId_EntityId1_EntityId2",
                table: "relation_strength_index",
                columns: new[] { "ProjectId", "EntityId1", "EntityId2" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_themes_Code",
                table: "themes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_uploads_Sha256",
                table: "uploads",
                column: "Sha256");

            migrationBuilder.CreateIndex(
                name: "IX_validation_items_ValidationReportId_ValidationType",
                table: "validation_items",
                columns: new[] { "ValidationReportId", "ValidationType" });

            migrationBuilder.CreateIndex(
                name: "IX_validation_reports_ProjectId_ChapterId_ValidatedAt",
                table: "validation_reports",
                columns: new[] { "ProjectId", "ChapterId", "ValidatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_validation_summaries_ProjectId_TargetVolumeNumber",
                table: "validation_summaries",
                columns: new[] { "ProjectId", "TargetVolumeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_volume_designs_CategoryId",
                table: "volume_designs",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_volume_designs_Name",
                table: "volume_designs",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_volume_designs_SourceBookId",
                table: "volume_designs",
                column: "SourceBookId");

            migrationBuilder.CreateIndex(
                name: "IX_volume_designs_VolumeNumber",
                table: "volume_designs",
                column: "VolumeNumber");

            migrationBuilder.CreateIndex(
                name: "IX_volume_fact_archives_ProjectId_VolumeNumber",
                table: "volume_fact_archives",
                columns: new[] { "ProjectId", "VolumeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_volumes_ProjectId_VolumeNumber",
                table: "volumes",
                columns: new[] { "ProjectId", "VolumeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_work_scope_ProjectId",
                table: "work_scope",
                column: "ProjectId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_world_rules_CategoryId",
                table: "world_rules",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_world_rules_Name",
                table: "world_rules",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_world_rules_SourceBookId",
                table: "world_rules",
                column: "SourceBookId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_api_keys");

            migrationBuilder.DropTable(
                name: "ai_models");

            migrationBuilder.DropTable(
                name: "app_settings");

            migrationBuilder.DropTable(
                name: "book_analyses");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "chapter_blueprints");

            migrationBuilder.DropTable(
                name: "chapter_plans");

            migrationBuilder.DropTable(
                name: "chapter_timelines");

            migrationBuilder.DropTable(
                name: "chapters");

            migrationBuilder.DropTable(
                name: "character_locations");

            migrationBuilder.DropTable(
                name: "character_movements");

            migrationBuilder.DropTable(
                name: "character_relationship_states");

            migrationBuilder.DropTable(
                name: "character_rules");

            migrationBuilder.DropTable(
                name: "character_state_points");

            migrationBuilder.DropTable(
                name: "chat_messages");

            migrationBuilder.DropTable(
                name: "conflict_progress_points");

            migrationBuilder.DropTable(
                name: "creative_materials");

            migrationBuilder.DropTable(
                name: "faction_rules");

            migrationBuilder.DropTable(
                name: "faction_state_points");

            migrationBuilder.DropTable(
                name: "foreshadowings");

            migrationBuilder.DropTable(
                name: "generation_records");

            migrationBuilder.DropTable(
                name: "generation_statistics");

            migrationBuilder.DropTable(
                name: "global_summary_cache");

            migrationBuilder.DropTable(
                name: "item_state_points");

            migrationBuilder.DropTable(
                name: "keyword_chapter_index");

            migrationBuilder.DropTable(
                name: "layer_completion_status");

            migrationBuilder.DropTable(
                name: "location_rules");

            migrationBuilder.DropTable(
                name: "location_state_points");

            migrationBuilder.DropTable(
                name: "manifests");

            migrationBuilder.DropTable(
                name: "notification_history");

            migrationBuilder.DropTable(
                name: "outlines");

            migrationBuilder.DropTable(
                name: "plot_points");

            migrationBuilder.DropTable(
                name: "plot_rules");

            migrationBuilder.DropTable(
                name: "prompt_templates");

            migrationBuilder.DropTable(
                name: "relation_strength_index");

            migrationBuilder.DropTable(
                name: "source_books");

            migrationBuilder.DropTable(
                name: "themes");

            migrationBuilder.DropTable(
                name: "uploads");

            migrationBuilder.DropTable(
                name: "validation_items");

            migrationBuilder.DropTable(
                name: "validation_summaries");

            migrationBuilder.DropTable(
                name: "volume_designs");

            migrationBuilder.DropTable(
                name: "volume_fact_archives");

            migrationBuilder.DropTable(
                name: "work_scope");

            migrationBuilder.DropTable(
                name: "world_rules");

            migrationBuilder.DropTable(
                name: "ai_providers");

            migrationBuilder.DropTable(
                name: "volumes");

            migrationBuilder.DropTable(
                name: "character_state_entries");

            migrationBuilder.DropTable(
                name: "chat_sessions");

            migrationBuilder.DropTable(
                name: "conflict_progress_entries");

            migrationBuilder.DropTable(
                name: "faction_state_entries");

            migrationBuilder.DropTable(
                name: "item_state_entries");

            migrationBuilder.DropTable(
                name: "location_state_entries");

            migrationBuilder.DropTable(
                name: "validation_reports");

            migrationBuilder.DropTable(
                name: "projects");
        }
    }
}
