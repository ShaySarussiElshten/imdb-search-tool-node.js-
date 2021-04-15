const fs = require('fs');
const cheerio = require('cheerio');
const got = require('got');
const axios = require('axios')
const prompt = require('prompt-sync')();
const { v4: uuidv4 } = require('uuid');
const { resolve } = require('path');
const { reject } = require('p-cancelable');



const genereListFilter = (i, link) => {
  // Return false if there is no href attribute.
  if(typeof link.attribs.href === 'undefined') { return false }

  return link.attribs.href.includes('/title?genres');
};

const directorsListFilter = (i, link) => {
  // Return false if there is no href attribute.
  if(typeof link.attribs.href === 'undefined') { return false }

  return link.attribs.href.includes('tt_ov_dr');
};

const starsListFilter = (i, link) => {
  // Return false if there is no href attribute.
  if(typeof link.attribs.href === 'undefined') { return false }

  return link.attribs.href.includes('tt_ov_st');
};

const titleMovieFilter = (i, link) => {
    // Return false if there is no href attribute.
    if(typeof link.attribs.href === 'undefined') { return false }
  
    return link.attribs.href.includes('/title/t');
};

const makeDetailesMovieAsString =(headline,genreList,rating,duration,arrayOfDirectors,arrayOfStars)=>{
    
    let strDetailes = ''
    
    if(headline !== '') 
        strDetailes += headline + ' | '

    if(genreList.length !== 0){
      strDetailes += 'Genre: '
      for(let i=0;i<genreList.length;i++){
         strDetailes += genreList[i] +', '
      }
      strDetailes += ' | '
    }

    if(rating !== '') 
        strDetailes += rating + ' | '
    
    if(duration !== '') 
        strDetailes += duration + ' | '

    if(arrayOfDirectors.length !== 0){
        strDetailes += 'Directors: '
        for(let i=0;i<arrayOfDirectors.length;i++){
            strDetailes += arrayOfDirectors[i] +', '
        }
        strDetailes += ' | '
    }

    if(arrayOfStars.length !== 0){
      strDetailes += 'Stars: '
      for(let i=0;i<arrayOfStars.length;i++){
          strDetailes += arrayOfStars[i] +', '
      }
    }

    return strDetailes

}

const requestListOfMovies =(serchTerm)=>{
  
  const URL= `https://www.imdb.com/find?s=tt&q=${serchTerm}&ref_=nv_sr_sm`
  
  return new Promise((resolve,reject) =>{
      got(URL).then(response => {
      
        const $ = cheerio.load(response.body);
        const arr = []
        
        
        $('.result_text a').filter(titleMovieFilter).each((i, link) => {
          const href = link.attribs.href;
          arr.push(href)   
        });
    
        resolve(arr)
        
      }).catch(err => {
        reject(err)
    });
  });

}

const isNotFuzzyHeadline =(hedline,serchTerm)=>{
    return hedline.toLowerCase().includes(serchTerm.toLowerCase())
}

const getMovieHeadline = ($,serchTerm) =>{
    const devalopmentMode = $('#quicklinksMainSection').text().trim().toLowerCase()
    
    if(!(devalopmentMode.includes('in development: more at pro'))){
        let headline = $('h1').text().trim()
        
        if(isNotFuzzyHeadline(headline,serchTerm))
            return headline
        else{
          throw new Error()
        }
    }
    else{
      throw new Error()
    }

}


const getMovieStars =($)=>{
    const arrayOfStars = []
    
    $('.credit_summary_item a').filter(starsListFilter).each((i, link) => {
        arrayOfStars.push(link.childNodes[0].data)
    });

    // the last item could be "see full cast..." therfore i need to remove this item
    if(arrayOfStars.length !== 0 && arrayOfStars[arrayOfStars.length-1].includes('See full cast'))
          arrayOfStars.pop()
    
    return arrayOfStars

}


const requstDetailesMovie =(Url,serchTerm)=>{
  return new Promise((resolve,reject) =>{
     axios.get(Url).then((res)=>{
        const $ = cheerio.load(res.data)

        const genreList = []
        
        $('.subtext a').filter(genereListFilter).each((i, link) => {
              genreList.push(link.childNodes[0].data)
          });


        let headline;

        try{
          headline = getMovieHeadline($,serchTerm)
        }catch(e){
          resolve('')
        }
        

        const duration = $('.subtext time').text().trim()
            
        const arrayOfDirectors = []

        $('.credit_summary_item a').filter(directorsListFilter).each((i, link) => {
            arrayOfDirectors.push(link.childNodes[0].data)
        });

        const arrayOfStars = getMovieStars($)
        
        const rating = $('.ratingValue').text().replace("\n",'').replace("/10",'').trim()

        const movieDetailes = makeDetailesMovieAsString(headline,genreList,rating,duration,arrayOfDirectors,arrayOfStars)
        resolve(movieDetailes)
      
     }).catch(err => {
        reject(err)
    });
  })
}


const getData = async (serchTerm)=>{
    
    const nameOfFileOutput = `output - ${uuidv4().slice(0,12)}.txt`
    let arrayOfMoviesAdress;
       
    try{
      arrayOfMoviesAdress = await requestListOfMovies(serchTerm)
      if(arrayOfMoviesAdress.length ===0){
          console.log('there is no match to this value :-)')
          return
      }
    }catch(e){
      console.log("something went wrong with fetch list detailes movies")
      return
    }
    
    
    const promiseMoviesList=[]
    
    for(let i=0;i<arrayOfMoviesAdress.length;i++){      
        
        const moviePromise = requstDetailesMovie(`https://www.imdb.com/${arrayOfMoviesAdress[i]}`,serchTerm)
        promiseMoviesList.push(moviePromise)
            
        moviePromise.then((respone,reject)=>{
            if(respone !== ''){
                resolve(respone)     
            }   
        }).catch( err=>
            console.log("something went wrong with fetch detailes movie")
        );      
    }

    //waitng for all promises
    Promise.all(promiseMoviesList).then((values) => {

      let stringOfMovies = ''
      
      for(let i=0;i<values.length;i++){
        if(values[i] === '')
             continue
        stringOfMovies += values[i] + '\n'
      }
      
      
      fs.writeFile(nameOfFileOutput, stringOfMovies, function (err) {
        if (err) throw err;
        console.log(`Done, the results are waiting for you in: "${nameOfFileOutput}"`)
      });
    });

    
}




const main = ()=>{
   
    const serchTerm = prompt('Please enter a search word and press Enter:  ');
    if(serchTerm === ''){
       console.log('you must enter some value')
       return
    }
    console.log("Please wait, this process may take a few seconds")

    getData(serchTerm.trim())
     
}

main()