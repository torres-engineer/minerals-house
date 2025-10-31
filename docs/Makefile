MAIN=report
LATEXMK=latexmk
BIBER=biber
# PDF2PS=gs -dNOPAUSE -dBATCH -sDEVICE=ps2write -sOutputFile=$(MAIN).ps
PDF2PS=pdf2ps
SHELL:=/bin/sh

LATEXMKFLAGS=-xelatex -shell-escape -interaction=nonstopmode -file-line-error

.PHONY: all pdf ps clean veryclean watch

all: pdf

pdf: $(MAIN).pdf

$(MAIN).pdf: $(MAIN).tex bibliography.bib
	@echo ">>> Building PDF using latexmk (XeLaTeX + biber)..."
	$(LATEXMK) $(LATEXMKFLAGS) $(MAIN).tex
	@echo ">>> PDF ready: $(MAIN).pdf"

ps: $(MAIN).ps

$(MAIN).ps: $(MAIN).pdf
	@echo ">>> Converting PDF to PS ..."
	$(PDF2PS) $(MAIN).pdf $(MAIN).ps
	@echo ">>> PS ready: $(MAIN).ps"

watch:
	@echo ">>> Watching source for changes (Ctrl+C to stop)..."
	$(LATEXMK) -pvc $(LATEXMKFLAGS) $(MAIN).tex

clean:
	@echo ">>> Cleaning auxiliary files..."
	$(LATEXMK) -c

veryclean: clean
	$(LATEXMK) -C

