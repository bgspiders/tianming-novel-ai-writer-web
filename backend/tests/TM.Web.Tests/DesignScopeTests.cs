using FluentAssertions;
using TM.Web.Application.Dtos.Design;
using TM.Web.Application.Dtos.Core;
using TM.Web.Domain.Entities.Core;
using TM.Web.Domain.Entities.Design;
using TM.Web.Infrastructure.Services.Core;
using TM.Web.Infrastructure.Services.Design;
using Xunit;

namespace TM.Web.Tests;

public class DesignScopeTests
{
    [Fact]
    public async Task ListPagedAsync_uses_project_current_source_book_as_forced_scope()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var sourceA = new SourceBook { Name = "源书 A" };
        var sourceB = new SourceBook { Name = "源书 B" };
        var project = new Project { Name = "项目", CurrentSourceBookId = sourceA.Id };

        db.SourceBooks.AddRange(sourceA, sourceB);
        db.Projects.Add(project);
        db.WorldRules.AddRange(
            new WorldRule { Name = "A 规则", SourceBookId = sourceA.Id },
            new WorldRule { Name = "B 规则", SourceBookId = sourceB.Id });
        await db.SaveChangesAsync();

        var service = new WorldRuleService(db);
        var result = await service.ListPagedAsync(new DesignListQuery(ProjectId: project.Id, Page: 1, PageSize: 20));

        result.Total.Should().Be(1);
        result.Items.Should().ContainSingle(x => x.Name == "A 规则");
    }

    [Fact]
    public async Task CreateAsync_uses_project_current_source_book_even_when_input_source_book_differs()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var sourceA = new SourceBook { Name = "源书 A" };
        var sourceB = new SourceBook { Name = "源书 B" };
        var project = new Project { Name = "项目", CurrentSourceBookId = sourceA.Id };

        db.SourceBooks.AddRange(sourceA, sourceB);
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var service = new WorldRuleService(db);
        var created = await service.CreateAsync(new WorldRuleUpsertDto(
            Name: "强制写入",
            SourceBookId: sourceB.Id,
            ProjectId: project.Id));

        created.SourceBookId.Should().Be(sourceA.Id);
    }

    [Fact]
    public async Task Category_create_uses_project_current_source_book()
    {
        var (db, connection) = await TestDb.CreateAsync();
        await using var _ = connection;
        await using var __ = db;

        var sourceA = new SourceBook { Name = "源书 A" };
        var sourceB = new SourceBook { Name = "源书 B" };
        var project = new Project { Name = "项目", CurrentSourceBookId = sourceA.Id };

        db.SourceBooks.AddRange(sourceA, sourceB);
        db.Projects.Add(project);
        await db.SaveChangesAsync();

        var service = new CategoryService(db);
        var created = await service.CreateAsync(new CategoryUpsertDto(
            ModuleType: "world_rules",
            Name: "分类",
            ParentId: null,
            SourceBookId: sourceB.Id,
            ProjectId: project.Id));

        created.SourceBookId.Should().Be(sourceA.Id);
    }
}
