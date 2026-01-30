% Latex style for final reports and dissertations (Instituto Politécnico de Beja)
% MAIN CLASS FILE: ipbeja-format.cls
% COMPILE YOUR MAIN .tex DOCUMENT WITH XeLaTeX or LuaLaTeX
% e.g., \documentclass[PT]{ipbeja-format} or \documentclass[EN]{ipbeja-format}

\newcommand{\version}{Version 2.01, 2025/06/10} \NeedsTeXFormat{LaTeX2e}
\ProvidesClass{ipbeja-format} [%
2025/06/10 \version, %
author: João Paulo Barros (joao.barros@ipbeja.pt)
]

\LoadClass[12pt,a4paper,oneside]{memoir}

% --- Language Option Handling ---
\def\LangOptPT{PTValue} % Internal unique value for Portuguese (actual content doesn't matter for \ifx if \let is used)
\def\LangOptEN{ENUKValue} % Internal unique value for English (UK)

% Define a unique marker for when no language has been explicitly selected yet
\def\IpbejaLangNotDefinedYet{IpbejaInternalUndefinedLanguageMarker}
\let\SelectedLang\IpbejaLangNotDefinedYet % Initialize \SelectedLang to this marker

% When an option is passed, \SelectedLang becomes an alias to \LangOptPT or \LangOptEN
\DeclareOption{PT}{\let\SelectedLang\LangOptPT}
\DeclareOption{EN}{\let\SelectedLang\LangOptEN}
\ProcessOptions % Process the options passed to the class

% Set default language to PT if \SelectedLang is still the initial marker
\ifx\SelectedLang\IpbejaLangNotDefinedYet
  \ClassWarning{ipbeja-format}{No language option (PT or EN) specified. Defaulting to PT (Portuguese).}
  \let\SelectedLang\LangOptPT % Default to PT
\fi
% --- End Language Option Handling ---

\RequirePackage{url}
\RequirePackage{xurl} % For better URL breaking in bib
\RequirePackage[top=4cm, bottom=3cm, left=3.5cm, right=2.5cm]{geometry}
\RequirePackage{setspace}

\RequirePackage{ebgaramond}
\RequirePackage{fontspec}
\RequirePackage{amsmath}
\RequirePackage{unicode-math}
\RequirePackage{microtype}

\RequirePackage[normalem]{ulem}
\RequirePackage[table]{xcolor}
\RequirePackage{float}

\RequirePackage[position=top,hypcap=false]{caption}

% --- BEGIN CUSTOM CAPTION SETUP ---
\DeclareCaptionFormat{ipbejacaption}{#1\par#3}

\captionsetup{
    format=ipbejacaption,
    labelsep=none,
    labelfont=bf,
    textfont=it,
    justification=raggedright,
    singlelinecheck=false,
    aboveskip=10pt,
    belowskip=10pt
}
% --- END CUSTOM CAPTION SETUP ---

\RequirePackage[backend=biber,style=apa,backref=true]{biblatex}
\DeclareFieldFormat{title}{\mkbibemph{#1}}

\setlength{\bibhang}{0.5cm} % Hanging indent for bib
\RequirePackage{listings}
\RequirePackage{tcolorbox}
\tcbuselibrary{breakable}
\RequirePackage{datetime2}
\RequirePackage{datetime2-calc}
\RequirePackage{csquotes}
\RequirePackage{longtable}
\RequirePackage{indentfirst}
\RequirePackage{graphicx}
\RequirePackage{lipsum}

\RequirePackage{chngcntr}
\RequirePackage{titletoc}

% --- Language-dependent settings (including babel loading) ---
\DeclareRobustCommand{\pt-en}[2]{%
  \ifx\SelectedLang\LangOptPT
    #1%
  \else
    #2%
  \fi
}

% Now, \ifx\SelectedLang\LangOptPT (and EN) will work correctly.
\ifx\SelectedLang\LangOptPT
    % --- Portuguese settings ---
    \RequirePackage[portuguese]{babel}
    \babelprovide[import]{portuguese}
    \useshorthands{"}
    \defineshorthand{"-}{\nobreak\hskip0pt\discretionary{-}{-}{-}\nobreak\hskip0pt}

    \renewcommand{\contentsname}{Índice}
    \renewcommand{\listfigurename}{Índice de Figuras}
    \renewcommand{\listtablename}{Índice de Tabelas}
    \renewcommand{\lstlistlistingname}{Índice de Listagens}
    \renewcommand{\figurename}{Figura}
    \renewcommand{\tablename}{Tabela}
    \renewcommand{\lstlistingname}{Listagem}
    \renewcommand{\appendixname}{Apêndice}
    \renewcommand{\appendixpagename}{Apêndices}
    \renewcommand{\appendixtocname}{Apêndices}

    \addto\captionsportuguese{%
        \renewcommand{\contentsname}{Índice}%
        \renewcommand{\listfigurename}{Índice de Figuras}%
        \renewcommand{\listtablename}{Índice de Tabelas}%
        \renewcommand{\lstlistlistingname}{Índice de Listagens}%
        \renewcommand{\lstlistingname}{Listagem}%
        \renewcommand{\figurename}{Figura}%
        \renewcommand{\tablename}{Tabela}%
        \renewcommand{\appendixname}{Apêndice}%
    }

    \DefineBibliographyStrings{portuguese}{%
        references = {Referências bibliográficas},
        bibliography = {Referências bibliográficas},
        backrefpage = {citado na página},%
        backrefpages = {citado nas páginas},%
    }
\else\ifx\SelectedLang\LangOptEN
    % --- English (UK) settings ---
    \RequirePackage[british]{babel}
    \babelprovide[import]{british}

    \renewcommand{\contentsname}{Table of Contents}
    \renewcommand{\listfigurename}{List of Figures}
    \renewcommand{\listtablename}{List of Tables}
    \renewcommand{\lstlistlistingname}{List of Listings}
    \renewcommand{\figurename}{Figure}
    \renewcommand{\tablename}{Table}
    \renewcommand{\lstlistingname}{Listing}
    \renewcommand{\appendixname}{Appendix}
    \renewcommand{\appendixpagename}{Appendices}
    \renewcommand{\appendixtocname}{Appendices}

    \addto\captionsbritish{%
        \renewcommand{\contentsname}{Table of Contents}%
        \renewcommand{\listfigurename}{List of Figures}%
        \renewcommand{\listtablename}{List of Tables}%
        \renewcommand{\lstlistlistingname}{List of Listings}%
        \renewcommand{\lstlistingname}{Listing}%
        \renewcommand{\figurename}{Figure}%
        \renewcommand{\tablename}{Table}%
        \renewcommand{\appendixname}{Appendix}%
    }

    \DefineBibliographyStrings{british}{%
        references = {References},
        bibliography = {References},
        backrefpage = {cited on page},%
        backrefpages = {cited on pages},%
    }
\else
    % This error should ideally not be reached if logic is correct
    % Note: \SelectedLang in the error message might show the marker if something went very wrong earlier
    \ClassError{ipbeja-format}{Internal error: Unknown language configuration. \SelectedLang \space is not \LangOptPT \space or \LangOptEN}{Check class options PT or EN, and class logic for \string\SelectedLang.}
\fi\fi
% --- End Language-dependent settings ---

\addbibresource{03-bibliography.bib}
\setmathfont{TeX Gyre Pagella Math}

\AtBeginDocument{%
  \counterwithout{figure}{chapter}%
  \counterwithout{table}{chapter}%
  \counterwithout{lstlisting}{chapter}%
  \renewcommand{\thefigure}{\arabic{figure}}%
  \renewcommand{\thetable}{\arabic{table}}%
}

\defbibheading{bibliography}[\pt-en{\bibstring{references}}{\bibstring{references}}]{%
  \clearpage
  \phantomsection
  \addcontentsline{toc}{chapter}{\protect\textsc{#1}}%
  {\noindent\fontsize{25}{30}\selectfont\scshape #1\par}%
  \vspace{2\baselineskip}%
  \nopagebreak
}

\definecolor{codegreen}{rgb}{0.008,0.522,0.016}
\definecolor{codeblue}{rgb}{0.122,0.027,1.0}
\definecolor{codegray}{rgb}{0.5,0.5,0.5}
\definecolor{codedarkred}{rgb}{0.459,0.08,0.114}
\definecolor{backcolour}{rgb}{0.95,0.95,0.95}

\lstdefinestyle{mystyle}{
    backgroundcolor=\color{backcolour}, commentstyle=\color{codegreen},
    keywordstyle=\color{codedarkred}, numberstyle=\tiny\color{codegray},
    stringstyle=\color{codeblue}, basicstyle=\ttfamily\footnotesize,
    breakatwhitespace=false, breaklines=true, captionpos=t,
    keepspaces=true, numbers=left, numbersep=5pt,
    showspaces=false, showstringspaces=false, showtabs=false, tabsize=2
}
\lstset{style=mystyle}

\newenvironment{code}{\captionsetup{type=listing}}{}

\newcommand{\doublerule}[2][0pt]{%
    \noindent
    \makebox[0pt][l]{\rule[#1]{\linewidth}{0.5#2}}%
    \rule[\dimexpr#1+.4ex]{\linewidth}{#2}}

\makeatletter
\makechapterstyle{chapteripbeja25}{%
    \setlength{\beforechapskip}{-40pt}
    \renewcommand*{\chapnamefont}{\normalfont\fontsize{25}{30}\selectfont\scshape}%
    \renewcommand*{\chaptitlefont}{\normalfont\fontsize{25}{30}\selectfont\scshape}%
    \renewcommand*{\chapnumfont}{\normalfont\fontsize{25}{30}\selectfont\scshape}%
    \renewcommand*{\printchaptername}{}%
    \renewcommand*{\printchapternonum}{}%
    \renewcommand*{\printchaptertitle}[1]{%
        \noindent\rule{\textwidth}{2pt}\\[0.001cm]
        \vspace{\baselineskip}%
        \noindent\fontsize{25}{30}\selectfont\scshape \@chapapp\ \thechapter\par\nobreak~\\
        \vspace*{-24pt}%
        \noindent\chaptitlefont ##1\par\nobreak
        \noindent\doublerule[1pt]{2pt}\par\nobreak
        \vspace{\baselineskip}%
    }
    \renewcommand*{\afterchapternum}{}%
    \renewcommand*{\afterchaptertitle}{}%
    \renewcommand*{\printchapternonum}{}%
    \renewcommand*{\printchaptername}{}%
    \renewcommand*{\printchapternum}{}%
}
\chapterstyle{chapteripbeja25}
\makeatother

\makeatletter
\newlength{\appendixvaluesep}
\setlength{\appendixvaluesep}{2\baselineskip}

\makechapterstyle{ipbejaappendixstyle}{%
  \setlength{\beforechapskip}{0pt}
  \setlength{\afterchapskip}{0pt}
  \renewcommand{\printchaptertitle}[1]{%
    \thispagestyle{empty}%
    \vspace*{5cm}
    \begin{center}
      {\chapnumfont \@chapapp\ \thechapter\par}
      \vspace{\appendixvaluesep}%
      {\chaptitlefont ##1\par}%
    \end{center}
    \vfill
    \clearpage
  }
  \renewcommand{\printchaptername}{}
  \renewcommand{\printchapternum}{}
  \renewcommand{\afterchapternum}{}
  \renewcommand{\afterchaptertitle}{}
  \renewcommand*{\chapnumfont}{\normalfont\fontsize{25}{30}\selectfont\scshape}
  \renewcommand*{\chaptitlefont}{\normalfont\fontsize{25}{30}\selectfont\scshape}
}
\makeatother

\renewcommand*{\secheadstyle}{\normalfont\LARGE\scshape}
\renewcommand*{\subsecheadstyle}{\normalfont\Large\scshape}
\renewcommand*{\subsubsecheadstyle}{\normalfont\large\scshape}
\renewcommand{\parttitlefont}{\centering\HUGE\scshape}
\renewcommand*{\thesubsubsection}{\Alph{subsubsection}.}

\cftsetindents{chapter}{0pt}{25pt}
\setlength{\cftsectionnumwidth}{35pt}
\setlength{\cftsubsectionnumwidth}{45pt}

\makeatletter
\renewcommand{\l@section}[2]{%
    \@dottedtocline{2}{0pt}{\cftsectionnumwidth}{#1}{#2}}
\renewcommand{\l@subsection}[2]{%
    \@dottedtocline{3}{0pt}{\cftsubsectionnumwidth}{#1}{#2}}
\makeatother

\renewcommand\cftbeforechapterskip{5pt plus 1pt}
\renewcommand{\baselinestretch}{1.5}

\DeclareRobustCommand{\paginadedicatoria}{%
    \makeatletter
    \@blankoddpage
    \thispagestyle{empty}%
    \begin{flushright}
    \ \\
    \vspace{5cm}
    \textit \DEDICATORIA
    \end{flushright}
    \@blankoddpage
    \makeatother
}

\DeclareRobustCommand{\apendices}{%
  \appendixpage
  \chapterstyle{ipbejaappendixstyle}
  \appendix
}

\DeclareRobustCommand{\anexos}{%
  \pt-en{%
      \renewcommand{\appendixpagename}{Anexos}%
      \renewcommand{\appendixname}{Anexo}%
      \renewcommand{\appendixtocname}{Anexos}%
  }{%
      \renewcommand{\appendixpagename}{Annexes}%
      \renewcommand{\appendixname}{Annex}%
      \renewcommand{\appendixtocname}{Annexes}%
  }
  \appendixpage
  \chapterstyle{ipbejaappendixstyle}
  \appendix
  \setcounter{chapter}{0}
}

\maxtocdepth{subsection}
\setsecnumdepth{subsubsection}

\newcommand{\rodape}[1]{\footnote{#1}}
\newcommand{\ing}[1]{\textit{#1}}

\graphicspath{{figuras/}}
\newcommand{\Java}{Java\textsuperscript{TM}}

\makeatletter
\newcommand{\tituloPretextual}[1]{%
    \clearpage
    \phantomsection
    \addcontentsline{toc}{chapter}{\protect\textsc{#1}}%
    {\noindent\fontsize{25}{30}\selectfont \scshape #1 \par}%
    \vspace{2\baselineskip}%
    \par\noindent%
}

\newcommand{\estilizarTituloListaMemoir}[2]{%
    \clearpage
    \phantomsection
    \addcontentsline{toc}{chapter}{\protect\textsc{#1}}%
    {\noindent\fontsize{25}{30}\selectfont \scshape #1 \par}%
    \par\nobreak\vskip 2\bigskipamount
    \@starttoc{#2}%
}

\newcommand{\indicegeral}{%
    \cleardoublepage
    \estilizarTituloListaMemoir{\contentsname}{toc}%
}

\newcommand{\indicedefiguras}{%
    \cleardoublepage
    \estilizarTituloListaMemoir{\listfigurename}{lof}%
}

\newcommand{\indicedetabelas}{%
    \cleardoublepage
    \estilizarTituloListaMemoir{\listtablename}{lot}%
}

\newcommand{\indicedelistagens}{%
    \cleardoublepage
    \estilizarTituloListaMemoir{\lstlistlistingname}{lol}%
}

\titlecontents{lstlisting}
  [0pt]
  {\addvspace{10pt}\normalsize}
  {\contentspush{\bfseries \lstlistingname\ \thecontentslabel\mdseries\quad}}
  {\hspace*{0em}}
  {\titlerule*[0.5pc]{.}\contentspage}
  [\addvspace{5pt}]

\titlecontents{figure}
  [0pt]
  {\addvspace{10pt}\normalsize}
  {\contentspush{\bfseries\figurename\ \thecontentslabel\mdseries\quad}}
  {\hspace*{0em}}
  {\titlerule*[0.5pc]{.}\contentspage}
  [\addvspace{5pt}]

\titlecontents{table}
  [0pt]
  {\addvspace{10pt}\normalsize}
  {\contentspush{\bfseries\tablename\ \thecontentslabel\mdseries\quad}}
  {\hspace*{0em}}
  {\titlerule*[0.5pc]{.}\contentspage}
  [\addvspace{5pt}]

\makeatother
\endinput