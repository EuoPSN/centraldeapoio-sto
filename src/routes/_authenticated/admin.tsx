<div className="flex items-center gap-2">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${mut.isPending ? "animate-spin" : ""}`} />
              {mut.isPending ? "Reindexando..." : resumeReindex ? "Continuar reindexação" : "Reindexar tudo"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reindexIncrementalMut.mutate()}
              disabled={reindexIncrementalMut.isPending}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {reindexIncrementalMut.isPending ? "Indexando..." : "Indexar novos conteúdos"}
            </Button>
          </div>