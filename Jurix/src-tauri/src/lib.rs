use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_lookups",
            sql: include_str!("../migrations/0001_create_lookups.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_lookups",
            sql: include_str!("../migrations/0002_seed_lookups.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_clientes",
            sql: include_str!("../migrations/0003_create_clientes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_contatos_pj",
            sql: include_str!("../migrations/0004_create_contatos_pj.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_processos",
            sql: include_str!("../migrations/0005_create_processos.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "processos_add_natureza",
            sql: include_str!("../migrations/0006_processos_add_natureza.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "processos_unique_numero",
            sql: include_str!("../migrations/0007_processos_unique_numero.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "create_contratos",
            sql: include_str!("../migrations/0008_create_contratos.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "pj_inscricoes_e_matriz",
            sql: include_str!("../migrations/0009_pj_inscricoes_e_matriz.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "create_lancamentos",
            sql: include_str!("../migrations/0010_create_lancamentos.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "create_parcelas",
            sql: include_str!("../migrations/0011_create_parcelas.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "create_agenda_eventos",
            sql: include_str!("../migrations/0012_create_agenda_eventos.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:jurix.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
