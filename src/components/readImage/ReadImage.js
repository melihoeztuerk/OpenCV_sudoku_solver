import React, { Component, createRef } from "react";
import { Container, Loader, Segment, Table, Input, Divider, Dimmer, Button, Ref } from "semantic-ui-react";
import Tesseract from 'tesseract.js';

let SudokuGrid = []

export default class ReadImage extends Component {
  constructor(props) {
    super(props);

    this.imageRef = createRef();
    this.image2Ref = createRef();
    this.inputRef = createRef();
    this.parentRef = createRef();
    this.sudokuTableRef = createRef();

    this.state = {
      loadingScript: false,
      loadingTesseract: false,

      runningOcr: false,
      solvingPuzzle: false
    };
  }

  componentDidMount() {
    this.setState(
      {
        loadingScript: true,
      },
      () => {
        const script = document.createElement("script");
        script.src = "./opencv.js";
        script.async = true;
        script.onload = () => this.scriptLoaded();

        document.body.appendChild(script);
      }
    );
  }

  sortPoints = (unsorted) => {
    let sortedPoints = [];
    for (let i = 0; i < 4; i++) sortedPoints.push({ x: 0, y: 0 });

    let middleX =
      (unsorted[0].x + unsorted[1].x + unsorted[2].x + unsorted[3].x) / 4;
    let middleY =
      (unsorted[0].y + unsorted[1].y + unsorted[2].y + unsorted[3].y) / 4;
    for (let i = 0; i < unsorted.length; i++) {
      if (unsorted[i].x < middleX && unsorted[i].y < middleY)
        // left top
        sortedPoints[0] = unsorted[i];
      // sortedPoints[0].x -= 1;
      // sortedPoints[0].y -= 1;
      if (unsorted[i].x > middleX && unsorted[i].y < middleY)
        // right top
        sortedPoints[1] = unsorted[i];
      // sortedPoints[1].x -= 1;
      // sortedPoints[1].y -= 1;
      if (unsorted[i].x < middleX && unsorted[i].y > middleY)
        // left bottom
        sortedPoints[2] = unsorted[i];
      // sortedPoints[2].x -= 1;
      // sortedPoints[2].y += 1;
      if (unsorted[i].x > middleX && unsorted[i].y > middleY)
        // right bottom
        sortedPoints[3] = unsorted[i];
      // sortedPoints[3].x -= 1;
      // sortedPoints[3].y += 1;
    }

    return sortedPoints;
  };

  preprocessImg = (target) => {
    let cv = window.cv;
    let ksize = new cv.Size(5, 5);
    cv.cvtColor(target, target, cv.COLOR_RGBA2GRAY, 0);

    cv.GaussianBlur(target, target, ksize, 0, 0, cv.BORDER_DEFAULT);

    cv.adaptiveThreshold(
      target,
      target,
      255,
      cv.ADAPTIVE_THRESH_MEAN_C,
      cv.THRESH_BINARY,
      11,
      2
    );

    cv.bitwise_not(target, target);

    let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    let anchor = new cv.Point(-1, -1);
    console.log(kernel);
    //cv.erode(target, target, kernel, anchor, 1);
    //cv.dilate(target, target, kernel, anchor, 1);
  };

  scriptLoaded() {
    this.setState({ loadingScript: false });

    console.log(window.cv);

    this.inputRef.current.addEventListener(
      "change",
      (e) => {
        console.log(e.target.files);
        this.imageRef.current.src = URL.createObjectURL(e.target.files[0]);
      },
      false
    );

    let imgRef = this.imageRef.current;
    let cv = window.cv;
    imgRef.onload = function () {
      let src = cv.imread(imgRef);
      let dst = src.clone();

      this.preprocessImg(dst);
      cv.imshow("canvasOutput", dst);

      let src2 = cv.imread("canvasOutput");
      let dst2 = cv.Mat.zeros(src2.rows, src2.cols, cv.CV_8UC3);
      cv.cvtColor(src2, src2, cv.COLOR_RGBA2GRAY, 0);
      //cv.threshold(src2, src2, 120, 200, cv.THRESH_BINARY);
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      // You can try more different parameters
      cv.findContours(
        src2,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );
      // draw contours with random Scalar
      let max_area = 0;
      let index = 0;

      for (let i = 0; i < contours.size(); ++i) {
        let c = contours.get(i);

        let tmpArea = cv.contourArea(c, false);

        if (max_area < tmpArea) {
          max_area = tmpArea;
          index = i;
        }
      }

      let target = contours.get(index);

      let tmpDst = dst2.clone();
      cv.drawContours(
        tmpDst,
        contours,
        index,
        new cv.Scalar(0, 255, 0),
        1,
        cv.LINE_8,
        hierarchy,
        0
      );
      cv.imshow("canvasOutput0-5", tmpDst);

      console.log("target contour:", target);
      let epsilon = 0.1 * cv.arcLength(target, true); // 10%
      let tmp = new cv.Mat();
      console.log("epsilon", epsilon);
      cv.approxPolyDP(target, tmp, epsilon, true);
      console.log("tmp", tmp);
      let poly = new cv.MatVector();
      poly.push_back(tmp);
      cv.drawContours(
        dst2,
        poly,
        0,
        new cv.Scalar(0, 255, 0),
        1,
        cv.LINE_8,
        hierarchy,
        0
      );
      console.log("tmp:", [...tmp.data32S]);
      /*
      let box = cv.boxPoints(rect)
      console.log("box: ", box)
      */

      let contourWithoutCircles = dst2.clone();
      cv.imshow("canvasOutput0-6", contourWithoutCircles);

      console.log(contours.get(index).data);
      let tmpArea = cv.contourArea(contours.get(index), false);
      console.log("AREA:", tmpArea);

      for (var i = 0; i < tmp.data32S.length; i += 2) {
        let tmpPoint = new cv.Point(tmp.data32S[i], tmp.data32S[i + 1]);
        console.log(tmpPoint);
        cv.circle(dst2, tmpPoint, 5, new cv.Scalar(0, 255, 255), -1);
      }

      cv.imshow("canvasOutput2", dst2);

      src2.delete();
      dst2.delete();
      contours.delete();
      hierarchy.delete();
      src.delete();
      dst.delete();

      let src3 = cv.imread(imgRef);

      let dst3 = new cv.Mat();
      let sudokuMaxWidth = tmp.data32S;
      let dsize = new cv.Size(src3.rows, src3.cols);
      console.log("tmp", [...tmp.data32S]);

      let topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorne;

      let corners = [];
      for (let i = 0; i < tmp.data32S.length; i += 2) {
        corners.push({
          x: tmp.data32S[i],
          y: tmp.data32S[i + 1],
        });
      }

      let sortedCorners = this.sortPoints(corners);
      console.log("sorted:", sortedCorners);
      let topEdge = sortedCorners[1].x - sortedCorners[0].x,
        bottomEdge = sortedCorners[3].x - sortedCorners[2].x,
        leftEdge = sortedCorners[2].y - sortedCorners[0].y,
        rightEdge = sortedCorners[3].y - sortedCorners[1].y;

      let edgeWidth = topEdge > bottomEdge ? topEdge : bottomEdge;
      let edgeHeight = leftEdge > rightEdge ? leftEdge : rightEdge;
      let totalWidth = edgeHeight > edgeWidth ? edgeHeight : edgeWidth;

      let srcTri = cv.matFromArray(
        4,
        1,
        cv.CV_32FC2,
        sortedCorners.flatMap((c) => [c.x, c.y])
      );
      let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0,
        0,
        totalWidth,
        0,
        0,
        totalWidth,
        totalWidth,
        totalWidth,
      ]);
      let M = cv.getPerspectiveTransform(srcTri, dstTri);
      // You can try more different parameters
      cv.warpPerspective(
        src3,
        dst3,
        M,
        dsize,
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar()
      );
      let dst3Prev = cv.imread(imgRef);
      for (var i = 0; i < tmp.data32S.length; i += 2) {
        let tmpPoint = new cv.Point(tmp.data32S[i], tmp.data32S[i + 1]);
        console.log(tmpPoint);
        cv.circle(dst3Prev, tmpPoint, 5, new cv.Scalar(0, 255, 255), -1);
      }
      cv.imshow("canvasOutput3-0", dst3Prev);

      cv.imshow("canvasOutput3", dst3);
      src3.delete();
      dst3.delete();
      M.delete();
      srcTri.delete();
      dstTri.delete();

      let src4 = cv.imread("canvasOutput3");
      let dst4 = new cv.Mat();
      let roi = new cv.Rect(0, 0, totalWidth, totalWidth);
      dst4 = src4.roi(roi);
      cv.copyMakeBorder(dst4, dst4, 10, 10, 10, 10, cv.BORDER_CONSTANT , new cv.Scalar(0));
      cv.imshow("canvasOutput4", dst4);

      src4.delete();
      dst4.delete();

      this.extractV();
      this.extractH();
      this.extractCells();
    };

    imgRef.onload = imgRef.onload.bind(this);
  }

  recognizeDigits = async (images) => {
    this.setState({ runningOcr: true }, async () => {
      var t0 = performance.now()

      let results = [];
      console.log("LENGTH", images.length);
      for (var i = 0; i < images.length; i++) {
        try {
          console.log(images[i]);
          let currImage = images[i];
          if (currImage) {
            let result = await this.recognizeDigit(images[i]);
            console.log("found:", result, i);
            results.push(result);
            var cell = document.getElementById("table-cell-" + (i + 1));
            cell.value = result;
            cell.parentNode.style.backgroundImage = `url(\"${currImage}\")`;
            cell.parentNode.style.backgroundPosition = "left";
            cell.parentNode.style.backgroundRepeat = "no-repeat";
          } else {
            results.push(".");
            var cell = document.getElementById("table-cell-" + (i + 1));
            cell.value = ".";
          }
        } catch (recognitionErr) {
          console.error(recognitionErr);
        }
      }

      var t1 = performance.now()
      console.log("Call to solveSudoku took " + (t1 - t0) + " milliseconds.")

      console.log("results: ", results);
      this.setState({ runningOcr: false });
    });
  }

  recognizeDigit = async (srcImg) => {
    let result = await Tesseract.recognize(srcImg, "eng", {
      init_oem: Tesseract.OEM.TESSERACT_ONLY,
      tessedit_char_whitelist: '0123456789',
    }).then((r) => {
      let match = r.data.text.match(/[0-9]/)
      let result =match ? match[0] : "."
      //console.log(cellIndex, result);
      return result
    });
    
    return result
  }
  extractCells = () => {
    let cv = window.cv;

    let src = cv.imread("canvasOutput10");
    let dst = cv.Mat.ones(src.cols, src.rows, cv.CV_8UC3);

    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.threshold(src, src, 250, 200, cv.THRESH_BINARY_INV);
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    // You can try more different parameters
    cv.findContours(
      src,
      contours,
      hierarchy,
      cv.RETR_CCOMP,
      cv.CHAIN_APPROX_SIMPLE
    );
    // draw contours with random Scalar
    let cnts = [];

    let parent = this.parentRef.current;
    parent.innerHTML = ""
    let images = []
    for (let i = contours.size() - 1; i >= 0; --i) {
      /*
      <div
            class="inputoutput"
            style={{ width: "30%", height: "auto", float: "left" }}
          >
            <canvas id="canvasOutput11"></canvas>
            <div class="caption">canvasOutput11</div>
          </div>
      */
      let node = document.createElement("div");
      node.style.width = "8%";
      node.style.height = "50px";
      node.style.float = "left";
      node.style.margin = "10px";

      let canvasElem = document.createElement("canvas");
      canvasElem.setAttribute("id", "canvasOutput-con-" + i);
      canvasElem.style.width = "auto";
      canvasElem.style.height = "100%";
      let captionElem = document.createElement("div");
      captionElem.classList.add("caption");
      captionElem.innerHTML = "canvasOutput-con-" + i;

      node.appendChild(canvasElem);
      node.appendChild(captionElem);

      parent.appendChild(node);

      canvasElem.onload = function() {
        console.log("asd")
      }

      let tmpSrc = cv.imread("canvasOutput4");
      let color = new cv.Scalar(
        Math.round(Math.random() * 255),
        Math.round(Math.random() * 255),
        Math.round(Math.random() * 255)
      );

      let tmpContour = contours.get(i);
      let rect = cv.boundingRect(tmpContour);
      let remBorder = 16
      rect.x += remBorder / 2
      rect.y += remBorder / 2
      rect.width -=  remBorder
      rect.height -= remBorder
      let tmpDst = tmpSrc.roi(rect);
      //cv.rectangle(tmpSrc, point1, point2, rectangleColor, 2, cv.LINE_AA, 0);
      //cv.drawContours(tmpSrc, contours, i, color, 1, cv.LINE_8, hierarchy, 1);

      
      // cv.imencode('.jpg', tmpDst, outBase64).toString('base64'); 
      // console.log(outBase64)
      tmpDst = tmpDst.clone()
      cv.cvtColor(tmpDst, tmpDst, cv.COLOR_RGBA2GRAY)
      cv.blur(tmpDst, tmpDst, new cv.Size(4, 4), new cv.Point(-1, -1), cv.BORDER_DEFAULT);
      cv.threshold(tmpDst, tmpDst, 150, 255, cv.THRESH_BINARY);
      //cv.bitwise_not(tmpDst, tmpDst)
      cv.imshow("canvasOutput-con-" + i, tmpDst);
      let outBase64 = canvasElem.toDataURL()
      console.log(outBase64)

      if (i !== 0){
        images.push(outBase64)
      }
    }

    this.recognizeDigits(images)

    // console.log(contours.map(c => console.log(cv.contourArea(c,false))))
    let contourList = [];
    for (let i = 0; i < contours.size(); ++i) {
      let c = cv.contourArea(contours.get(i), false);
      if (c > 2000 && c < 3900) {
        contourList.push(contours.get(i));
      }
    }

    console.log(contours.size());

    cv.imshow("canvasOutput11", src);
  };

  extractV = () => {
    let cv = window.cv;

    /* horizontal lines */
    let src = cv.imread("canvasOutput4");

    let tmpSrc = new cv.Mat();
    cv.cvtColor(src, tmpSrc, cv.COLOR_RGBA2GRAY, 0);

    // You can try more different parameters
    let tmpM = new cv.Mat();
    let tmpKsize = new cv.Size(tmpSrc.cols / 20, 1);
    tmpM = cv.getStructuringElement(cv.MORPH_RECT, tmpKsize);
    let tmpAnchor = new cv.Point(-1, -1);
    cv.dilate(
      tmpSrc,
      tmpSrc,
      tmpM,
      tmpAnchor,
      2,
      cv.BORDER_CONSTANT,
      cv.morphologyDefaultBorderValue()
    );
    cv.erode(
      tmpSrc,
      tmpSrc,
      tmpM,
      tmpAnchor,
      1,
      cv.BORDER_CONSTANT,
      cv.morphologyDefaultBorderValue()
    );

    cv.blur(
      tmpSrc,
      tmpSrc,
      new cv.Size(2, 2),
      new cv.Point(-1, -1),
      cv.BORDER_DEFAULT
    );
    cv.adaptiveThreshold(
      tmpSrc,
      tmpSrc,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      57,
      5
    );

    cv.bitwise_not(tmpSrc, tmpSrc);

    let lines = new cv.Mat();
    let src2 = cv.imread("canvasOutput4");
    src2 = cv.Mat.zeros(src2.rows, src2.cols, cv.CV_8UC3);
    src2.setTo(new cv.Scalar(255, 255, 255));
    cv.Canny(tmpSrc, tmpSrc, 50, 200, 3);
    cv.Canny(tmpSrc, tmpSrc, 50, 100, 3);
    // You can try more different parameters
    cv.HoughLines(tmpSrc, lines, 1, Math.PI / 180, 200);
    console.log("HoughLines", lines.data32F.length);

    const threshold = 40;
    let collectedLines = [];
    // draw lines
    for (let i = 0; i < lines.rows; ++i) {
      let rho = lines.data32F[i * 2];
      let theta = lines.data32F[i * 2 + 1];
      let a = Math.cos(theta);
      let b = Math.sin(theta);
      let x0 = a * rho;
      let y0 = b * rho;
      let startPoint = { x: x0 - 1000 * b, y: y0 + 1000 * a };
      let endPoint = { x: x0 + 1000 * b, y: y0 - 1000 * a };
      collectedLines.push({ startPoint, endPoint });
    }

    // cv.line(src2, startPoint, endPoint, new cv.Scalar(255, 0, 0, 255));

    collectedLines.sort((a, b) => {
      return (
        (a.startPoint.y + a.endPoint.y) / 2 -
        (b.startPoint.y + b.endPoint.y) / 2
      );
    });

    let unsortedLines = [...collectedLines]
    let dstUnsortedLines = cv.Mat.zeros(src2.rows, src2.cols, cv.CV_8UC3);
    dstUnsortedLines.setTo(new cv.Scalar(255, 255, 255));

    let prevLine = null;
    for (let i = 0; i < collectedLines.length; ++i) {
      let tmp = collectedLines[i];

      unsortedLines.push(tmp)
      cv.line(dstUnsortedLines, tmp.startPoint, tmp.endPoint,  new cv.Scalar(255, 0, 0, 255))

      let tmpY = (tmp.startPoint.y + tmp.endPoint.y) / 2;
      let tmpPrev = prevLine
        ? (prevLine.startPoint.y + prevLine.endPoint.y) / 2
        : null;
      if (
        prevLine &&
        tmpPrev + threshold > tmpY &&
        tmpPrev - threshold < tmpY
      ) {
        continue;
      }
      prevLine = tmp;
      cv.line(
        src2,
        tmp.startPoint,
        tmp.endPoint,
        new cv.Scalar(255, 0, 0, 255)
      );
    }

    console.log(collectedLines);

    collectedLines.forEach((line) => {
      //cv.line(src2, line.startPoint, line.endPoint, new cv.Scalar(255, 0, 0, 255));
    });

    cv.imshow("canvasOutput10", src2);
    cv.imshow("canvasOutput10-0", src2);
    cv.imshow("canvasOutput10-00", dstUnsortedLines);
    cv.imshow("canvasOutput10-1-0", dstUnsortedLines);
    
  };

  extractH = () => {
    let cv = window.cv;

    /* horizontal lines */
    let src = cv.imread("canvasOutput4");

    let tmpSrc = new cv.Mat();
    cv.cvtColor(src, tmpSrc, cv.COLOR_RGBA2GRAY, 0);

    // You can try more different parameters
    let tmpM = new cv.Mat();
    let tmpKsize = new cv.Size(1, tmpSrc.rows / 20);
    tmpM = cv.getStructuringElement(cv.MORPH_RECT, tmpKsize);
    let tmpAnchor = new cv.Point(-1, -1);
    cv.dilate(
      tmpSrc,
      tmpSrc,
      tmpM,
      tmpAnchor,
      2,
      cv.BORDER_CONSTANT,
      cv.morphologyDefaultBorderValue()
    );
    cv.erode(
      tmpSrc,
      tmpSrc,
      tmpM,
      tmpAnchor,
      1,
      cv.BORDER_CONSTANT,
      cv.morphologyDefaultBorderValue()
    );

    cv.blur(
      tmpSrc,
      tmpSrc,
      new cv.Size(2, 2),
      new cv.Point(-1, -1),
      cv.BORDER_DEFAULT
    );
    cv.adaptiveThreshold(
      tmpSrc,
      tmpSrc,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      57,
      5
    );

    cv.bitwise_not(tmpSrc, tmpSrc);

    let lines = new cv.Mat();
    let src2 = cv.imread("canvasOutput10");

    cv.Canny(tmpSrc, tmpSrc, 50, 200, 3);
    cv.Canny(tmpSrc, tmpSrc, 50, 100, 3);
    // You can try more different parameters

    cv.HoughLines(tmpSrc, lines, 1, Math.PI / 180, 200);
    console.log("HoughLines", lines.data32F.length);

    const threshold = 40;
    let collectedLines = [];
    // draw lines
    for (let i = 0; i < lines.rows; ++i) {
      let rho = lines.data32F[i * 2];
      let theta = lines.data32F[i * 2 + 1];
      let a = Math.cos(theta);
      let b = Math.sin(theta);
      let x0 = a * rho;
      let y0 = b * rho;
      let startPoint = { x: x0 - 1000 * b, y: y0 + 1000 * a };
      let endPoint = { x: x0 + 1000 * b, y: y0 - 1000 * a };
      collectedLines.push({ startPoint, endPoint });
    }

    // cv.line(src2, startPoint, endPoint, new cv.Scalar(255, 0, 0, 255));

    collectedLines.sort((a, b) => {
      return a.startPoint.x - b.startPoint.x;
    });

    let unsortedLines = [...collectedLines]
    let dstUnsortedLines = cv.imread("canvasOutput10-1-0")

    let prevLine = null;
    for (let i = 0; i < collectedLines.length; ++i) {
      let tmp = collectedLines[i];

      unsortedLines.push(tmp)
      cv.line(dstUnsortedLines, tmp.startPoint, tmp.endPoint,  new cv.Scalar(255, 0, 0, 255))

      let tmpX = (tmp.startPoint.x + tmp.endPoint.x) / 2;
      let tmpPrevX = prevLine
        ? (prevLine.startPoint.x + prevLine.endPoint.x) / 2
        : null;
      if (
        prevLine &&
        tmpPrevX + threshold > tmpX &&
        tmpPrevX - threshold < tmpX
      ) {
        continue;
      }
      prevLine = tmp;
      cv.line(src2, tmp.startPoint, tmp.endPoint, new cv.Scalar(0, 255, 0, 255));
    }

    console.log(collectedLines);

    collectedLines.forEach((line) => {
      //cv.line(src2, line.startPoint, line.endPoint, new cv.Scalar(255, 0, 0, 255));
    });

    cv.imshow("canvasOutput10", src2);
    cv.imshow("canvasOutput10-1", src2);
    cv.imshow("canvasOutput10-1-0", dstUnsortedLines);
  };

  handleCanvasClicked = (e) => {
    let url = e.target.toDataURL("image/png");
    var newTab = window.open();
    newTab.document.body.innerHTML = `<img src="${url}">`;
  };

  displayResult = async (name) => {
    let values = []
    console.log(name)

    for(let i = 1; i < 82; i++) {
      let targetInput = document.getElementById("table-cell-" + i)
      if(targetInput.value && targetInput.value !== ".") {
        values.push(parseInt(targetInput.value))
      }else {
        values.push(0)
      }
    }

    for(let i= 0; i < 9; i++) {
      SudokuGrid[i] = values.slice(i * 9, (i * 9) + 9)
    }

    let prevSudoku = JSON.parse(JSON.stringify(SudokuGrid))

    console.log(SudokuGrid)

    var t0 = performance.now()
    let isSolvable = this.solveSudoku()

    var t1 = performance.now()
    console.log("Call to solveSudoku took " + (t1 - t0) + " milliseconds.")

    console.log("solved:", SudokuGrid)

    if (isSolvable && name === "isSolvable") {
      this.setState({solvingPuzzle: false})
      alert(isSolvable ? "Puzzle is solvable" : "Puzzle is not solvable");
    } else {
      this.setState(
        {
          solvingPuzzle: false,
        },
        () => {
          console.log("prevSudoku:", prevSudoku);
          if (name === "solveSingle") {
            for (let row = 0; row < 9; row++) {
              for (let col = 0; col < 9; col++) {
                let targetInput = document.getElementById(
                  "table-cell-" + (row * 9 + col + 1)
                );
                
                targetInput.value = SudokuGrid[row][col];

                if(prevSudoku[row][col] !== SudokuGrid[row][col]) {
                  return;
                }
              }
            }


          } else {
            for (let row = 0; row < 9; row++) {
              for (let col = 0; col < 9; col++) {
                let targetInput = document.getElementById(
                  "table-cell-" + (row * 9 + col + 1)
                );
                targetInput.value = SudokuGrid[row][col];
              }
            }
          }
        }
      );
    }
  }

  solvePuzzle = (e) => {
    //e.preventDefault();
    SudokuGrid = []

    this.setState({
      solvingPuzzle: true,
    });
    this.displayResult(e.target.name) 
  }

  solveSudoku = () => {
    for(let row= 0; row < SudokuGrid.length; row++) {
      for(let col =0; col < SudokuGrid[0].length; col++) {
        if(SudokuGrid[row][col] === 0) {
          for(let number = 1; number <= 9; number++) {
            if(!this.checkQuadrant(row, col, number) && !this.checkCol(col, number) && !this.checkRow(row, number)) {
              SudokuGrid[row][col] = number
              if(this.solveSudoku()) {
                return true
              } else {
                SudokuGrid[row][col] = 0
              }
            }
          }
          return false
        }
      }
    }
    return true
  }

  checkRow = (row, val) => {
    let res = false
    
    for(let i = 0; i < SudokuGrid.length; i++) {
      if(SudokuGrid[row][i] === val) {
        res = true
        break
      }
    }

    return res
  }

  checkCol = (col, val) => {
    let res = false

    for(let i = 0; i < SudokuGrid.length; i++) {
      if(SudokuGrid[i][col] === val) {
        res = true
        break
      }
    }

    return res
  }

  checkQuadrant = (row, col, val) => {
    console.log()
    if(row >= 0 && row <= 2) {
      // first quadrant
      if(col > 0 && col <= 2) {
        for(let x = 0; x <= 2; x++) {
          for(let j =0; j <= 2; j++) {
            console.log(SudokuGrid, x,j,val)
            console.log(SudokuGrid[x])
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
      //check second quadrant
      else if(col >= 3 && col <= 5) {
        for(let x = 0; x <= 2; x++) {
          for(let j =3; j <= 5; j++) {
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
      //check third quadrant
      else if(col >= 6 && col <= 8) {
        for(let x = 0; x <= 2; x++) {
          for(let j =6; j <= 8; j++) {
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
    }
    else if(row >= 3 && row <= 5) {
      //check fourth quadrant
      if(col >= 0 && col <= 2) {
        for(let x = 3; x <= 5; x++) {
          for(let j = 0; j <= 2; j++) {
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
      //check fifth quadrant
      else if(col >= 3 && col <= 5) {
        for(let x = 3; x <= 5; x++) {
          for(let j = 3; j <= 5; j++) {
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
      //check sixth quadrant
      else if(col >= 6 && col <= 8) {
        for(let x = 3; x <= 5; x++) {
          for(let j = 6; j <= 8; j++) {
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
    }
    else if(row >= 6 && row <= 8) {
      //check seventh quadrant
      if(col >= 0 && col <= 2) {
        for(let x = 6; x <= 8; x++) {
          for(let j = 0; j <= 2; j++) {
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
      //check eighth quadrant
      else if(col >= 3 && col <= 5) {
        for(let x = 6; x <= 8; x++) {
          for(let j = 3; j <= 5; j++) {
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
      //check nineth quadrant
      else if(col >= 6 && col <= 8) {
        for(let x = 6; x <= 8; x++) {
          for(let j = 6; j <= 8; j++) {
            if(SudokuGrid[x][j] === val) {
              return true
            }
          }
        }
        return false
      }
    }

    return false
  }

  render() {
    const { loadingScript, loadingTesseract } = this.state;
    if (loadingScript) {
      return <Loader active content="Lade OpenCV" />;
    }

    if(loadingTesseract) {
     return <Loader active content="Lade Tesseract" />;
    }
    return (
      <div>
        <Segment style={{display:"inline-block"}}>
          <div class="inputoutput">
            <img
              ref={this.imageRef}
              alt="No Image"
              style={{ width: "30%", height: "auto" }}
            />
            <div class="caption">
              imageSrc <input type="file" ref={this.inputRef} name="file" />
            </div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas
              id="canvasOutput"
              onClick={this.handleCanvasClicked}
            ></canvas>
            <div class="caption">canvasOutput</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas
              id="canvasOutput0-5"
              onClick={this.handleCanvasClicked}
            ></canvas>
            <div class="caption">canvasOutput0-5</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas
              id="canvasOutput0-6"
              onClick={this.handleCanvasClicked}
            ></canvas>
            <div class="caption">canvasOutput0-6</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas
              id="canvasOutput2"
              onClick={this.handleCanvasClicked}
            ></canvas>
            <div class="caption">canvasOutput2</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas
              id="canvasOutput3-0"
              onClick={this.handleCanvasClicked}
            ></canvas>
            <div class="caption">canvasOutput3-0</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas
              id="canvasOutput3"
              onClick={this.handleCanvasClicked}
            ></canvas>
            <div class="caption">canvasOutput3</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas
              id="canvasOutput4"
              onClick={this.handleCanvasClicked}
            ></canvas>
            <div class="caption">canvasOutput4</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas
              id="canvasOutput4-2"
              onClick={this.handleCanvasClicked}
            ></canvas>
            <div class="caption">canvasOutput4-2</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas id="canvasOutput10-00" onClick={this.handleCanvasClicked}></canvas>
            <div class="caption">canvasOutput10-00</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas id="canvasOutput10-0" onClick={this.handleCanvasClicked}></canvas>
            <div class="caption">canvasOutput10-0</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas id="canvasOutput10-1-0" onClick={this.handleCanvasClicked}></canvas>
            <div class="caption">canvasOutput10-1-0</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas id="canvasOutput10-1" onClick={this.handleCanvasClicked}></canvas>
            <div class="caption">canvasOutput10-1</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas id="canvasOutput10" onClick={this.handleCanvasClicked}></canvas>
            <div class="caption">canvasOutput10</div>
          </div>
          <div
            class="inputoutput"
            style={{
              width: "30%",
              height: "auto",
              float: "left",
            }}
          >
            <canvas id="canvasOutput11" onClick={this.handleCanvasClicked}></canvas>
            <div class="caption">canvasOutput11</div>
          </div>
        </Segment>
        <Segment style={{ display: "contents" }}>
          <div
            ref={this.parentRef}
            style={{ clear: "both", display: "inline-block", padding: "10px" }}
          ></div>
        </Segment>
        <Segment>
          <Dimmer active={this.state.runningOcr}>
            <Loader active={this.state.runningOcr} content="Bitte warten..." />
          </Dimmer>
          <Dimmer active={this.state.solvingPuzzle}>
            <Loader active={this.state.solvingPuzzle} content="Löse Puzzle..." />
          </Dimmer>
          <div ref={this.sudokuTableRef}>
            <Table celled basic="very" size="small">
              <Table.Body>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                  return (
                    <Table.Row key={i}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => {
                        return (
                          <Table.Cell key={i * 9 + j + 1} textAlign="center">
                            <input
                              name={"table-cell-" + (i * 9 + j + 1)}
                              id={"table-cell-" + (i * 9 + j + 1)}
                              onInput={(e) => {
                                console.log(e.target.value);
                                let value = e.target.value;

                                if (value.match(/\d$/)) {
                                  e.target.value = value.match(/\d$/)[0];
                                } else {
                                  e.target.value = ".";
                                }
                              }}
                              style={{
                                width: "2em",
                                height: "2em",
                                fontSize: "1.8em",
                                textAlign: "center",
                              }}
                            />
                            {i * 9 + j}
                          </Table.Cell>
                        );
                      })}
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </div>
          <Button.Group>
            <Button content="Solve all" positive onClick={(e) => this.solvePuzzle(e)} name="solveAll" />
            <Button content="Solve partially" onClick={(e) => this.solvePuzzle(e)} name="solveSingle"  />
            <Button content="Is solvable?" color="brown" onClick={(e) => this.solvePuzzle(e)} name="isSolvable" />
          </Button.Group>
        </Segment>
      </div>
    );
  }
}
