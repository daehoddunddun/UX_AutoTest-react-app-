const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const express = require("express");
const cors = require("cors");

const app = express();
const port = 8080;

/* [api] */
app.use(cors());

app.get("/crawling", async (req, res) => {
  let reqList = req.query;
  const { potal, date, length } = reqList;
  await crawling(potal, date, length);
  res.send(crawlingData);
});

app.listen(port, () => {
  console.log(`서버가 ${port}로 실행중입니다.`);
});

/* [crawling] */
const crawlingData = []; // 크롤링 데이터를 받은 Array

let crawling = async (potal, date, length) => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--window-size=1920,1080"],
  }); // puppeteer 실행 // {headless: false}는 크롤링 과정을 GUI로 확인하기 위해 적용(없어도 이상 x)

  const page = await browser.newPage(); // 신규 page 생성

  await page.setViewport({
    width: 1920,
    height: 1080,
  }); // GUI View 사이즈 지정

  switch (potal) {
    case "naver":
      await page.goto(
        "https://search.naver.com/search.naver?where=image&sm=tab_jum&query=강아지"
      ); //수집채널1-Naver 키워드 검색창으로 이동
      await page.waitForSelector("._listImage"); // * 스크랩하려는 태그가 랜더링 완료되기 전까지 기다린다.
      break;
    case "daum":
      await page.goto(
        "https://search.daum.net/search?w=img&nil_search=btn&DA=NTB&enc=utf8&q=%EA%B0%95%EC%95%84%EC%A7%80"
      ); //수집채널2-Daum = 키워드 검색창으로 이동
      await page.waitForSelector(".thumb_img");
      break;
    case "google":
      await page.goto(
        "https://www.google.com/search?q=%EA%B0%95%EC%95%84%EC%A7%80&source=lnms&tbm=isch"
      ); //수집채널3-Google 키워드 검색창으로 이동
      await page.waitForSelector(".rg_i.Q4LuWd");
      break;
    case "instagram":
      // await page.goto(
      //   "https://www.instagram.com/"
      // ); //수집채널4-Instagram 로그인 시 스크롤 가능한 문제 논의 필요
      break;
  }

  await autoScroll(page); // 자동 스크롤 시작(스크롤 시 태그 생성 때문에 추가한 내용)

  async function autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        var totalHeight = 0;
        var distance = 100;
        var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100); // distance로 스크롤 내리는 속도를 조절함(100 빠르지만 데이터를 전부 수집 못하는 에러로 length 100정도까지만/ 200권장 / 300 느림)
      });
    });
  }

  const content = await page.content(); // * 페이지 컨텐츠 생성한다.

  const $ = cheerio.load(content); // cheerio에 컨트츠를 인자로 넣어준다.

  switch (potal) {
    // 수집채널1-Naver 크롤링 css 선택자 지정
    case "naver":
      const naverLists = $(
        "._contentRoot > .photo_group._listGrid > .photo_tile._grid > div > div > .thumb > a "
      );

      naverLists.each((idx, list) => {
        const src =
          $(list).find("img").attr("data-lazy-src") === undefined
            ? $(list).find("img").attr("src")
            : $(list).find("img").attr("data-lazy-src");
        crawlingData.push({ idx, src });
      }); // 네이버 이미지의 src 가 data-lazy-src 를 참조하는 내용도 있어서 삼항연산자로 통일
      break;

    case "daum":
      // 수집채널2-Daum 크롤링 css 선택자 지정
      const daumLists = $(
        ".g_comp > #imgColl > .coll_cont > #imgList > .wrap_thumb > a"
      );
      daumLists.each((idx, list) => {
        const src = $(list).find("img").attr("src");
        crawlingData.push({ idx, src });
      });
      break;

    case "google":
      //수집채널3-Google 크롤링 css 선택자 지정
      const googleLists = $(
        "#islrg > .islrc > div > .wXeWr.islib.nfEiy > .bRMDJf.islir"
      );

      googleLists.each((idx, list) => {
        const src = $(list).find("img").attr("src");
        crawlingData.push({ idx, src });
      });
      break;

    case "instagram":
      break;
  }

  if (crawlingData.length >= 100) {
    crawlingData.length = 100;
  } //요청 데이터의 length

  /* 지워도 되는 내용 */
  // await page.click("._listImage"); //부가 기능 - 해당 태그를 클릭
  // await page.screenshot({ path: "screen.png" }); // 부가 기능 - 스크린샷 찍기
  // console.dir(crawlingData.length, { maxArrayLength: null }); // 수집한 전체 데이터

  await browser.close(); // 브라우저 종료
};