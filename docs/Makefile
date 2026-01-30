LATEX=latexmk
FLAGS=-pdflua
FILE=01-main-document
BIBLIOGRAPHY=03-bibliography.bib

.PHONY: pdf clean veryclean watch

pdf:
	$(LATEX) $(FLAGS) $(FILE)

watch:
	$(LATEX) -pvc $(FLAGS) $(FILE)

clean:
	$(LATEX) $(FLAGS) -c

veryclean: clean
	$(LATEX) $(FLAGS) -C
